const crypto = require("node:crypto");

crypto.DEFAULT_ENCODING = "hex";

function describe() {
	return `encoding is ${crypto.DEFAULT_ENCODING}`;
}

module.exports = describe;
