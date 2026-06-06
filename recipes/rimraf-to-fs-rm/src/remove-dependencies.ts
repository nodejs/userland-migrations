import type { SgNode, Transform } from '@codemod.com/jssg-types/main';
import type Json from '@codemod.com/jssg-types/langs/json';
import removeDependencies from '@nodejs/codemod-utils/remove-dependencies';

const rimrafPackages = [
	'rimraf',
	'rimraf-v3',
	'rimraf-v4',
	'rimraf-v5',
	'@types/rimraf',
];

/**
 * Decodes a JSON string node text while keeping invalid values unchanged.
 */
function parseJsonString(value: string): string {
	try {
		return JSON.parse(value) as string;
	} catch {
		return value;
	}
}

/**
 * Returns whether package.json scripts still call the rimraf CLI.
 */
function hasRimrafCliScript(rootNode: SgNode<Json>): boolean {
	const scriptsPair = rootNode.find({
		rule: {
			kind: 'pair',
			all: [
				{
					has: {
						field: 'key',
						kind: 'string',
						regex: '^"scripts"$',
					},
				},
				{
					has: {
						field: 'value',
						kind: 'object',
					},
				},
			],
		},
	});

	const scriptsObject = scriptsPair?.field('value');
	if (!scriptsObject) return false;

	const scriptPairs = scriptsObject.findAll({
		rule: { kind: 'pair' },
	});

	return scriptPairs.some((pair) => {
		const value = pair.field('value');
		if (!value?.is('string')) return false;

		return /\brimraf(?:\s|$)/.test(parseJsonString(value.text()));
	});
}

/**
 * Removes rimraf packages when package scripts no longer need the rimraf CLI.
 */
const transform: Transform<Json> = async (root) => {
	if (hasRimrafCliScript(root.root())) return null;

	return removeDependencies(rimrafPackages, {
		packageJsonPath: root.filename(),
		runInstall: false,
		persistFileWrite: false,
	});
};

export default transform;
