const { fips: fipsRenamed } = require("node:crypto");

if (fipsRenamed) {
	console.log("FIPS mode is enabled");
}
fipsRenamed = true;
