const crypto = require("node:crypto");

if (crypto.getFips()) {
	console.log("FIPS mode is enabled");
}
