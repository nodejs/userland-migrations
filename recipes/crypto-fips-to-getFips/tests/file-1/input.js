const crypto = require("node:crypto");

if (crypto.fips) {
	console.log("FIPS mode is enabled");
}
