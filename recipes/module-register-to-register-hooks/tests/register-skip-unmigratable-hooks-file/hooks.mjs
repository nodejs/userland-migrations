import { readFile } from "node:fs/promises";

export async function load(url, context, nextLoad) {
	const source = await readFile(new URL(url));
	return nextLoad(url, { ...context, source });
}
