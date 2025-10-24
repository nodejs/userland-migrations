import { getFips, setFips } from "node:crypto";

if (getFips()) {
	console.log("FIPS mode is enabled");
}
setFips(true);
