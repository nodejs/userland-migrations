const crypto = require("node:crypto");

if (process.env.ENABLE_FIPS === "true") {
	crypto.setFips(true);
}
console.log("FIPS enabled:", crypto.getFips());
