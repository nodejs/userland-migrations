import { fips as fipsRenamed } from "node:crypto";

if (fipsRenamed) {
	console.log("FIPS mode is enabled");
}
fipsRenamed = true;
