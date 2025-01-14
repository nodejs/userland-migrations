import path from 'node:path';

import { build, type BuildOptions } from 'esbuild';


export const outfile = 'bundle.js';

export async function bundle(recipeAbsPath: string) {
	const pjson = await import(path.join(recipeAbsPath, 'package.json'), jsonImportAttrs)
		.then(pluckDefault);
	const recipeOptions = await import(path.join(recipeAbsPath, 'esbuild.config.ts'))
		.then(pluckDefault)
		.catch(handleImportErr);
	const options: BuildOptions = {
		...recipeOptions,
		bundle: true,
		entryPoints: [path.join(recipeAbsPath, pjson.main)],
		loader: {
			'.node': 'file',
		},
		minify: true,
		outfile: path.join(recipeAbsPath, 'bundle.js'),
		platform: 'node',
		sourcemap: 'inline',
		target: 'node20',
	};

	console.debug(`Generating bundle for ${pjson.name} with options`);
	console.debug(options);

	await build(options);

	console.log(`Bundle for ${pjson.name} generated successfully`);
}

function pluckDefault(mod) {
	return mod.default;
}
function handleImportErr(err: NodeJS.ErrnoException) {
	if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err;
	return {};
}
const jsonImportAttrs: ImportCallOptions = { with: { type: 'json' } };
