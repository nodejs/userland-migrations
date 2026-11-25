const crypto = require("node:crypto");

// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20; its value is inlined here.
const encoding = "buffer";

console.log(encoding);
