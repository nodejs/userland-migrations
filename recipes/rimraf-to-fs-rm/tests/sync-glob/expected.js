import { globSync, rmSync } from "node:fs";

for (const filePath of globSync("dist/**/*.js")) {
	rmSync(filePath, { recursive: true, force: true });
}
