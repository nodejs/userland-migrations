const { fips } = require("node:crypto");

if (fips) {
	console.log("FIPS mode is enabled");
}
fips = true;
