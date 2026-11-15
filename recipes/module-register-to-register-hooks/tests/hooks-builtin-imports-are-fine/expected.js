import { fileURLToPath } from "node:url";
import path from "node:path";

export function load(url, context, nextLoad) {
	const result = nextLoad(url, context);
	return { ...result, filename: path.basename(fileURLToPath(url)) };
}
