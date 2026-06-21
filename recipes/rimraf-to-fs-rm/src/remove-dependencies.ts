import type { SgNode, Transform } from '@codemod.com/jssg-types/main';
import type Json from '@codemod.com/jssg-types/langs/json';
import removeDependencies from '@nodejs/codemod-utils/remove-dependencies';

const rimrafPackages = [
	'rimraf',
	'@types/rimraf',
];

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

	return Boolean(
		scriptsObject.find({
			rule: {
				kind: 'pair',
				has: {
					field: 'value',
					kind: 'string',
					has: {
						kind: 'string_content',
						regex: '\\brimraf(?:\\s|$)',
					},
				},
			},
		}),
	);
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
