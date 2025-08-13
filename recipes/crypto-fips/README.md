# `crypto.fips` DEP0093

This recipe provides a guide for migrating from the deprecated `crypto.fips` to `crypto.getFips()` and `crypto.setFips()`.

See [DEP0093](https://nodejs.org/api/deprecations.html#DEP0093).

## Examples

**Before:**

```js
// Using crypto.fips
crypto.fips;

// Using crypto.fips = true
crypto.fips = true;

// Using crypto.fips = false
crypto.fips = false;
```

**After:**

```js
// Using crypto.getFips()
crypto.getFips();

// Using crypto.setFips(true)
crypto.setFips(true);

// Using crypto.setFips(false)
crypto.setFips(false);
```
