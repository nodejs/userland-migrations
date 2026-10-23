const crypto = require("node:crypto");

// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20.
// Pass the encoding explicitly to each crypto call instead, e.g. `hash.digest("hex")`.

module.exports = { crypto };
