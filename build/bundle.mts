import path from 'node:path';
import { cwd } from 'node:process';

import { build, type BuildOptions } from 'esbuild';


const pjson = await import(path.join(cwd(), 'package.json'), { with: { type: 'json' } }).then(pluckDefault);
const recipeOptions = await import(path.join(cwd(), 'esbuild.config.ts'))
	.then(pluckDefault)
	.catch((err) => {
		if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err;
		return {};
	});
const options: BuildOptions = {
	...recipeOptions,
	bundle: true,
	entryPoints: [pjson.main],
	loader: {
		// '.node': 'file',
	},
	outfile: 'bundle.js',
	platform: 'node',
	target: 'node20',
};

console.debug('Generating bundle with options');
console.debug(options);

await build(options);

console.log('Bundle generated successfully');

function pluckDefault(mod) { return mod.default }
