# `crypto.fips` DEP0093

This recipe transforms the usage from the deprecated `crypto.fips` to `crypto.getFips()` and `crypto.setFips()`.

See [DEP0093](https://nodejs.org/api/deprecations.html#DEP0093).

## Examples

```diff
  import crypto from "node:crypto";
- import { fips } from "node:crypto";
+ import { getFips, setFips } from "node:crypto";

  // Using crypto.fips
- crypto.fips;
+ crypto.getFips();
- fips;
+ getFips();

  // Using crypto.fips = true
- crypto.fips = true;
+ crypto.setFips(true);
- fips = true;
+ setFips(true);

  // Using crypto.fips = false
- crypto.fips = false;
+ crypto.setFips(false);
- fips = false;
+ setFips(false);
`````
