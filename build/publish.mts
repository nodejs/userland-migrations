import path from 'node:path';
import { argv, cwd, exit } from 'node:process';
import { parseArgs } from 'node:util';

import { publish } from 'codemod';

import { bundle, outfile } from './bundle.mts';


const {
	recipes,
	status,
} = parseArgs({
	args: argv,
	options: {
		recipes: { type: 'string' },
		status: { type: 'boolean' },
	},
}).values;
const recipeRelPaths: string[] = recipes?.slice(1, -1).split(' ') ?? [];

if (!status) throw new Error(`Unexpected status: ${status}`);

const rootPath = cwd();

const n = recipeRelPaths.length;
const publications = new Array(n);
for (let r = n - 1; r > -1; r--) {
	const recipeRelPath = recipeRelPaths[r];
	const recipeAbsPath = path.join(rootPath, recipeRelPath);

	publications[r] = bundle[r](recipeAbsPath)
		.then(() => publish(path.join(recipeAbsPath, outfile)));
}

Promise.allSettled(publications)
	.then(
		() => console.log('Publishing complete'),
		() => console.log('Publishing failed'),
	);
