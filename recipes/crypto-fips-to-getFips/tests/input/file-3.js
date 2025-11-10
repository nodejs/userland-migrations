const crypto = require("node:crypto");

if (process.env.ENABLE_FIPS === "true") {
	crypto.fips = true;
}
console.log("FIPS enabled:", crypto.fips);
