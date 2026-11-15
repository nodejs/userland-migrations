import { fileURLToPath } from "node:url";
import path from "node:path";

export async function load(url, context, nextLoad) {
	const result = await nextLoad(url, context);
	return { ...result, filename: path.basename(fileURLToPath(url)) };
}
