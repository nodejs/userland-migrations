const { createHash } = require("node:crypto");

// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20; its value is inlined here.
const digest = createHash("sha1").update("data").digest("buffer");
