---
authors: Herrtian
---

# DEP0153: `dns.lookup` Options Type Coercion

Node.js used to coerce the values of the `family`, `hints`, `all`, and `verbatim` options passed to `dns.lookup()` and `dnsPromises.lookup()` — for example, treating `family: "4"` as `family: 4`. This implicit coercion is deprecated, and newer versions of Node.js throw an `ERR_INVALID_ARG_TYPE` error instead. This codemod converts literal option values to their proper types, resolving `lookup` bindings from both `node:dns` and `node:dns/promises` across CommonJS and ESM, including namespace, destructured, and aliased imports. See [DEP0153](https://nodejs.org/api/deprecations.html#DEP0153).

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/dns-lookup-options-coercion
```

## Examples

### `dns.lookup` with literal options

Numeric options given as strings become numbers, and `0`/`1` flags become booleans.

```diff
 const dns = require("node:dns");

-dns.lookup("example.com", { family: "4", hints: "0", all: 1, verbatim: 0 }, callback);
+dns.lookup("example.com", { family: 4, hints: 0, all: true, verbatim: false }, callback);
```

### Destructured `lookup` import

String booleans such as `"false"` are converted too, whatever form the binding takes.

```diff
 const { lookup } = require("node:dns");

-lookup("example.com", { family: "4", all: "false" }, callback);
+lookup("example.com", { family: 4, all: false }, callback);
```

### `node:dns/promises`

The promises API is handled the same way.

```diff
 import { lookup } from "node:dns/promises";

-await lookup("example.com", { family: "6", all: "true" });
+await lookup("example.com", { family: 6, all: true });
```

### Aliased `promises` namespace

Aliased bindings of the `promises` export are resolved as well.

```diff
 import { promises as dnsPromises } from "node:dns";

-await dnsPromises.lookup("example.com", { family: "4", verbatim: "false" });
+await dnsPromises.lookup("example.com", { family: 4, verbatim: false });
```

## Limitations

This recipe only changes literal option values written inline in the `lookup()` call. Dynamic values such as `{ family: familyOption }`, constants like `dns.ADDRCONFIG`, and options objects stored in a variable are intentionally left unchanged and need manual review.

<!-- sync_to_learn: false -->
