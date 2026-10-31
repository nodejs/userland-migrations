const crypto = require("node:crypto");

// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20.
// Pass the encoding explicitly to each crypto call instead, e.g. `hash.digest("hex")`.

// TODO(DEP0091): `crypto.DEFAULT_ENCODING` was removed in Node.js v20; give this read an explicit encoding.
const encoding = crypto.DEFAULT_ENCODING;
