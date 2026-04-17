const { getFips, setFips } = require("node:crypto");

if (getFips()) {
	console.log("FIPS mode is enabled");
}
setFips(true);
