const crypto = require("node:crypto");

// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20.
// Pass the encoding explicitly to each crypto call instead, e.g. `hash.digest("hex")`.

function describe() {
	// DEP0091: `crypto.DEFAULT_ENCODING` was removed in Node.js v20; its value is inlined here.
	return `encoding is ${"hex"}`;
}

module.exports = describe;
