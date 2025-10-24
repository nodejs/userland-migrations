# `crypto.fips` DEP0093

This recipe transforms the usage from the deprecated `crypto.fips` to `crypto.getFips()` and `crypto.setFips()`.

See [DEP0093](https://nodejs.org/api/deprecations.html#DEP0093).

## Examples

**Before:**

```js
import crypto from "node:crypto";
import { fips } from "node:crypto";

// Using crypto.fips
crypto.fips;
fips;

// Using crypto.fips = true
crypto.fips = true;
fips = true;

// Using crypto.fips = false
crypto.fips = false;
fips = false;
```

**After:**

```js
import crypto from "node:crypto";
import { getFips, setFips } from "node:crypto";

// Using crypto.getFips()
crypto.getFips();
getFips();

// Using crypto.setFips(true)
crypto.setFips(true);
setFips(true);

// Using crypto.setFips(false)
crypto.setFips(false);
setFips(false);
```
