---
authors: FrustratedBoy420
---

# DEP0201: `Duplex.toWeb()` `type` option

Passing `options.type` to `Duplex.toWeb()` is runtime-deprecated since Node.js 26.0.0. Use `options.readableType` instead. It sets the type of the readable half of the returned readable-writable pair. This codemod renames `type` to `readableType` in inline options objects. It resolves `Duplex` from `stream` and `node:stream` across CommonJS and ESM, including namespace, default, destructured, and aliased imports. See [DEP0201](https://nodejs.org/api/deprecations.html#DEP0201).

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/duplex-toweb-readabletype
```

## Examples

### Inline options

```diff
 import { Duplex } from 'node:stream';

-const pair = Duplex.toWeb(stream, { type: 'bytes' });
+const pair = Duplex.toWeb(stream, { readableType: 'bytes' });
```

### Shorthand property with an aliased import

The shorthand property is expanded. The variable keeps its name.

```diff
 const { Duplex: NodeDuplex } = require('stream');
 const type = 'bytes';

-const pair = NodeDuplex.toWeb(stream, { type });
+const pair = NodeDuplex.toWeb(stream, { readableType: type });
```

## Limitations

The codemod leaves these calls unchanged and prints a warning for manual review:

- Options that contain both `type` and `readableType`. Node.js uses `readableType ?? type`, so removing `type` can change behaviour.
- Options that contain spread elements, computed keys, getters, setters, methods, or duplicate `type` keys.

Options passed as a variable (for example `Duplex.toWeb(stream, options)`) are not changed, because the object can be shared or mutated elsewhere.
