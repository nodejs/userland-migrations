---
authors: max-programming
---

# DEP0093: crypto.fips crypto.getFips() / crypto.setFips()

Replaces the deprecated `crypto.fips` property with the `crypto.getFips()` and `crypto.setFips()` functions. Reading `crypto.fips` becomes a call to `crypto.getFips()`, and assigning to `crypto.fips` becomes a call to `crypto.setFips(value)`. Both namespace imports (`const crypto = require('crypto')`) and destructured imports (`const { fips } = require('crypto')`) are handled, including ESM `import` syntax.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/crypto-fips-to-getFips
```

## Examples

### Example 1

Reading `crypto.fips` becomes `crypto.getFips()`.

```diff
 const crypto = require("node:crypto");

-if (crypto.fips) {
+if (crypto.getFips()) {
   console.log("FIPS mode is enabled");
 }
```

### Example 2

Assigning to `crypto.fips` becomes `crypto.setFips(value)`.

```diff
 const crypto = require("node:crypto");

-crypto.fips = true;
+crypto.setFips(true);
```

### Example 3

Both read and write usages are handled in the same file.

```diff
 const crypto = require("node:crypto");

 if (process.env.ENABLE_FIPS === "true") {
-  crypto.fips = true;
+  crypto.setFips(true);
 }
-console.log("FIPS enabled:", crypto.fips);
+console.log("FIPS enabled:", crypto.getFips());
```

### Example 4

Works with ESM default imports.

```diff
 import crypto from "node:crypto";

-const fipsStatus = crypto.fips;
-crypto.fips = !fipsStatus;
+const fipsStatus = crypto.getFips();
+crypto.setFips(!fipsStatus);
```
