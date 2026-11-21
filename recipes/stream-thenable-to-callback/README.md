---
authors: Harshall25
---

# DEP0157: Thenable Support in Streams

Node.js removed the undocumented thenable support in streams, so an `async` stream implementation method no longer has its returned promise awaited by the stream machinery: rejections are swallowed and the stream can stall. See [DEP0157](https://nodejs.org/api/deprecations.html#DEP0157). This codemod rewrites `async` implementation methods into the callback form the streams API expects, turning each sequential `await` into a `.then()` link and routing failures to a trailing `.catch()`. It covers `_write`, `_writev`, `_read`, `_transform`, `_flush` and `_final` on classes that extend a stream, and `write`, `writev`, `read`, `transform`, `flush` and `final` in the options object passed to `Writable`, `Readable`, `Transform`, `Duplex` and `PassThrough`, in both CommonJS and ESM.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/stream-thenable-to-callback
```

## Examples

### Example 1

A single `await` followed by the callback - the `async` keyword is dropped and errors are routed to `callback(err)`:

```diff
 const writable = new Writable({
-	async write(chunk, encoding, callback) {
-		await someAsyncOperation(chunk);
-		callback();
+	write(chunk, encoding, callback) {
+		someAsyncOperation(chunk)
+			.then(() => callback())
+			.catch(err => callback(err));
 	}
 });
```

### Example 2

Sequential `await`s - each step becomes a `.then()` link, and the awaited binding becomes the parameter of the next one:

```diff
 const transform = new Transform({
-	async transform(chunk, encoding, callback) {
-		const step1 = await operation1(chunk);
-		const step2 = await operation2(step1);
-		callback(null, step2);
+	transform(chunk, encoding, callback) {
+		operation1(chunk)
+			.then(step1 => operation2(step1))
+			.then(step2 => callback(null, step2))
+			.catch(err => callback(err));
 	}
 });
```

### Example 3

`read` and `_read` take no callback, so the chain ends in `this.push()` and rejections go to `this.destroy()`:

```diff
 const readable = new Readable({
-	async read(size) {
-		const data = await fetchData(size);
-		this.push(data);
+	read(size) {
+		fetchData(size)
+			.then(data => this.push(data))
+			.catch(err => this.destroy(err));
 	}
 });
```

### Example 4

An existing `try`/`catch` whose handler only forwards the error is folded into the `.catch()` link:

```diff
 const writable = new Writable({
-	async write(chunk, encoding, callback) {
-		try {
-			await someAsyncWork(chunk);
-			callback();
-		} catch (err) {
-			callback(err);
-		}
+	write(chunk, encoding, callback) {
+		someAsyncWork(chunk)
+			.then(() => callback())
+			.catch(err => callback(err));
 	}
 });
```

## Notes

A method is only treated as a stream implementation when the stream class is resolved from a `node:stream` import in the same file: a class that extends it, or an options object passed to `new` on it. A plain object or an unrelated class that happens to have an `async write()` method is left alone, because it is not a stream.

Indentation of the generated chain is read from the surrounding source, and the file's existing line endings are preserved.

### Limitations

The rewrite is skipped, and the original `async` method left untouched, whenever the chain could not be reproduced faithfully:

- **The first awaited expression is optionally chained.** `await this.connection?.close()` short-circuits to `undefined` when the receiver is nullish, so `.then()` would throw instead of calling back.
- **A binding is used more than one step later.** In a `.then()` chain each step only sees the previous step's value, so a variable read two statements after it was declared cannot be expressed without restructuring.
- **The `catch` block does more than forward the error.** A handler that also logs, retries or branches is not collapsed into `.catch(err => callback(err))`, and a `finally` block is never rewritten.
- **An `await` is not a whole statement.** Only `await expr;` and `const name = await expr;` are chained; something like `log(await save(chunk));` is not.
- **Async generators.** `async *_read()` is a different protocol and is never rewritten.
- **A step rebinds the callback parameter**, which would change what `.catch()` ends up calling.
