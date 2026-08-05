import type { Codemod, Edit } from 'codemod:ast-grep';
import type JS from 'codemod:ast-grep/langs/javascript';
import { useMetricAtom } from 'codemod:metrics';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';

const migrationMetric = useMetricAtom('create-require-from-path-migrations');
const filesMetric = useMetricAtom('create-require-from-path-files');

/**
 * Transform function that updates code to replace deprecated `createRequireFromPath` usage
 * with the modern `createRequire` API from the `module` or `node:module` package.
 *
 * Handles:
 * 1. Updates import/require statements that import `createRequireFromPath`:
 *    - `const { createRequireFromPath } = require('module')` → `const { createRequire } = require('module')`
 *    - `const { createRequireFromPath } = require('node:module')` → `const { createRequire } = require('node:module')`
 *    - `import { createRequireFromPath } from 'module'` → `import { createRequire } from 'module'`
 *    - `import { createRequireFromPath } from 'node:module'` → `import { createRequire } from 'node:module'`
 *
 * 2. Updates variable declarations that use `createRequireFromPath`:
 *    - `const myRequire = createRequireFromPath(arg)` → `const myRequire = createRequire(arg)`
 *    - `let myRequire = createRequireFromPath(arg)` → `let myRequire = createRequire(arg)`
 *    - `var myRequire = createRequireFromPath(arg)` → `var myRequire = createRequire(arg)`
 *
 * 3. Preserves original variable names and declaration types.
 */
const transform: Codemod<JS> = async (root) => {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// Step 1: Find and update destructuring assignments from require('module') or require('node:module')
	const requireStatements = getNodeRequireCalls(root, 'module');

	for (const statement of requireStatements) {
		// Find the object pattern (destructuring)
		const objectPattern = statement.find({
			rule: {
				kind: 'object_pattern',
			},
		});

		if (objectPattern) {
			const originalText = objectPattern.text();

			if (originalText.includes('createRequireFromPath')) {
				const newText = originalText.replace(
					/\bcreateRequireFromPath\b/g,
					'createRequire',
				);
				edits.push(objectPattern.replace(newText));
				migrationMetric.increment({ kind: 'require-destructure' });
			}
		}
	}

	const importStatements = getNodeImportStatements(root, 'module');

	for (const statement of importStatements) {
		// Find the named imports
		const namedImports = statement.find({
			rule: {
				kind: 'named_imports',
			},
		});

		if (namedImports) {
			const originalText = namedImports.text();

			if (originalText.includes('createRequireFromPath')) {
				const newText = originalText.replace(
					/\bcreateRequireFromPath\b/g,
					'createRequire',
				);
				edits.push(namedImports.replace(newText));
				migrationMetric.increment({ kind: 'import-named' });
			}
		}
	}

	const renamedImports = rootNode.findAll({
		rule: {
			any: [
				{
					kind: 'pair_pattern',
					all: [
						{
							has: {
								field: 'key',
								kind: 'property_identifier',
							},
						},
						{
							has: {
								field: 'value',
								kind: 'identifier',
							},
						},
					],
				},
				{
					kind: 'import_specifier',
					all: [
						{
							has: {
								field: 'alias',
								kind: 'identifier',
							},
						},
						{
							has: {
								field: 'name',
								kind: 'identifier',
							},
						},
					],
				},
			],
		},
	});

	for (const rename of renamedImports) {
		if (rename?.text().includes('createRequireFromPath')) {
			const key = rename.find({
				rule: {
					has:
						rename.kind() === 'import_specifier'
							? {
									field: 'name',
									kind: 'identifier',
								}
							: {
									field: 'key',
									kind: 'property_identifier',
								},
				},
			});

			edits.push(key.replace('createRequire'));
			migrationMetric.increment({
				kind: 'renamed-alias',
				source: rename.kind() === 'import_specifier' ? 'esm' : 'cjs',
			});
		}
	}

	// Step 2: Find and replace createRequireFromPath function calls
	const functionCalls = rootNode.findAll({
		rule: {
			pattern: 'createRequireFromPath($ARG)',
		},
	});

	for (const call of functionCalls) {
		const argMatch = call.getMatch('ARG');
		if (argMatch) {
			const arg = argMatch.text();
			const replacement = `createRequire(${arg})`;
			edits.push(call.replace(replacement));
			migrationMetric.increment({ kind: 'function-call' });
		}
	}

	if (!edits.length) {
		filesMetric.increment({ status: 'no-changes' });
		return null;
	}

	filesMetric.increment({ status: 'migrated' });

	return rootNode.commitEdits(edits);
}

export default transform;
