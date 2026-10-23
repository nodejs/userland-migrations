const crypto = require("node:crypto");

crypto.DEFAULT_ENCODING = "hex";

function reset() {
	crypto.DEFAULT_ENCODING = "base64";
}

module.exports = reset;
