---
authors: aditya-bheke
---

# DEP0091: `crypto.DEFAULT_ENCODING`

Removes the `crypto.DEFAULT_ENCODING` property, which reached end-of-life in Node.js v20.0.0, and makes the encodings it used to control explicit. Reads of the property are replaced with the value they resolved to, assignments are removed, and the assigned encoding is pushed down into the `digest()` calls it used to govern. Namespace imports (`const crypto = require('node:crypto')`), destructured and aliased imports, ESM `import` syntax, and dynamic `await import()` are all handled. See [DEP0091](https://nodejs.org/api/deprecations.html#DEP0091).

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/crypto-default-encoding
```

## Examples

### Example 1

Reading the property - the value it resolved to is inlined. `crypto.DEFAULT_ENCODING` defaulted to `"buffer"`, so a file that never assigned to it reads as `"buffer"`:

```diff
 const crypto = require("node:crypto");

-const encoding = crypto.DEFAULT_ENCODING;
+// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20; its value is inlined here.
+const encoding = "buffer";

 console.log(encoding);
```

### Example 2

Assigning to the property, with nothing in the file that depended on it - the assignment goes away and a note takes its place:

```diff
 const crypto = require("node:crypto");

-crypto.DEFAULT_ENCODING = "hex";
+// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20.
+// Pass the encoding explicitly to each crypto call instead, e.g. `hash.digest("hex")`.

 module.exports = { crypto };
```

### Example 3

Assigning to the property to change the output of a hash - the encoding moves into the `digest()` call, so no note is needed:

```diff
 const crypto = require("node:crypto");

-crypto.DEFAULT_ENCODING = "hex";
 const hash = crypto.createHash("sha256");
 hash.update("some data");
-const result = hash.digest();
+const result = hash.digest("hex");
```

### Example 4

A `||` (or `??`) fallback - the property always held a non-empty string, so the fallback was never reached and is dropped with the read:

```diff
 const crypto = require("node:crypto");

-const encoding = crypto.DEFAULT_ENCODING || "binary";
+// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20; its value is inlined here.
+const encoding = "buffer";
 const hash = crypto.createHash("md5").update("data").digest(encoding);
```

### Example 5

Destructured and aliased bindings - the binding is dropped from the import, and the import goes with it when nothing else is imported:

```diff
-const { DEFAULT_ENCODING, createHash } = require("node:crypto");
+const { createHash } = require("node:crypto");

-const digest = createHash("sha1").update("data").digest(DEFAULT_ENCODING);
+// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20; its value is inlined here.
+const digest = createHash("sha1").update("data").digest("buffer");
```

### Example 6

ESM namespace import - a comparison against the property becomes a comparison against the value it resolved to, which makes a branch that can never be taken visible:

```diff
 import crypto from "node:crypto";

-if (crypto.DEFAULT_ENCODING === "hex") {
+// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20; its value is inlined here.
+if ("buffer" === "hex") {
```

### Example 7

An assignment the codemod cannot evaluate - the read is left in place and flagged instead of being given a wrong value:

```diff
 const crypto = require("node:crypto");

-crypto.DEFAULT_ENCODING = process.env.CRYPTO_ENCODING;
+// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20.
+// Pass the encoding explicitly to each crypto call instead, e.g. `hash.digest("hex")`.

-const encoding = crypto.DEFAULT_ENCODING;
+// TODO(DEP0091): `crypto.DEFAULT_ENCODING` was removed in Node.js v20; give this read an explicit encoding.
+const encoding = crypto.DEFAULT_ENCODING;
```

## Notes

`crypto.DEFAULT_ENCODING` was documented as defaulting to `"buffer"`, which is the value a read is given when the file never assigns to the property. When the file does assign a single string literal to it, that literal is used instead, because reads in the file resolved to it.

Every rewritten site is annotated, because the right encoding is an application decision the codemod cannot make. Review the annotations, replace the inlined value with the encoding the code actually wants, and delete the comments.

### Limitations

- `crypto.DEFAULT_ENCODING` was process-wide: another module could assign to it and change what every read in the program returned. This codemod only sees the file it is transforming, so a file whose encoding was set elsewhere resolves to `"buffer"`. Check for assignments across the codebase before trusting the inlined value.
- Only `digest()` on a `createHash()` or `createHmac()` result receives the assigned encoding automatically; its encoding argument is unambiguous. Other APIs that honoured the property - `sign.sign()`, `verify.verify()`, `cipher.update()`, `cipher.final()`, `decipher.update()`, `decipher.final()`, `DiffieHellman` and `ECDH` methods - take encodings in positions that cannot be filled in safely without knowing the surrounding code, so they are left for the comment to flag.
- A file that assigns two different literals to the property, or assigns an expression that is not a string literal, is not resolvable: assignments are still removed, but reads are left in place with a `TODO(DEP0091)` comment.
- A namespace binding (`const crypto = require("node:crypto")`) left unused by the transformation is kept. Only destructured and named bindings of `DEFAULT_ENCODING` itself are removed.
