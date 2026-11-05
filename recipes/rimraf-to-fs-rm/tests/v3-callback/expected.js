import { rm } from "node:fs";

rm("dist", { recursive: true, force: true }, (error) => {
	if (error) throw error;
});
