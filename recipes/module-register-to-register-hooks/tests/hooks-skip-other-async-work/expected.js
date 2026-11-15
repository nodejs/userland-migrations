import { readFile } from "node:fs/promises";

export async function resolve(specifier, context, nextResolve) {
	return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
	if (url.endsWith(".txt")) {
		const source = await readFile(new URL(url), "utf8");
		return { format: "module", source: `export default ${JSON.stringify(source)}`, shortCircuit: true };
	}

	return await nextLoad(url, context);
}
