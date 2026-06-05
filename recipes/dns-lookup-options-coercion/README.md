# dns.lookup options type coercion DEP0153

Handle DEP0153 by converting literal `dns.lookup()` and `dnsPromises.lookup()` option values to their proper types.

See [DEP0153](https://nodejs.org/api/deprecations.html#dep0153-dnslookup-and-dnspromiseslookup-options-type-coercion).

## Example

```diff
  const dns = require("node:dns");

- dns.lookup("example.com", { family: "4", all: 1 }, callback);
+ dns.lookup("example.com", { family: 4, all: true }, callback);
```

```diff
  import { lookup } from "node:dns/promises";

- await lookup("example.com", { family: "6", verbatim: 0 });
+ await lookup("example.com", { family: 6, verbatim: false });
```

## Limitations

This recipe only changes literal option values. Dynamic values such as `{ family: familyOption }` need manual review.
