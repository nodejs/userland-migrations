import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import type { SgRoot, Edit } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/**
 * Transform function that updates code to replace deprecated `tmpDir` usage
 * with the modern `tmpdir` API from the `os` or `node:os` package.
 *
 * Handles:
 * 1. Updates import/require statements that import `tmpDir`:
 *    - `const { tmpDir } = require('os')` → `const { tmpdir } = require('os')`
 *    - `const { tmpDir } = require('node:os')` → `const { tmpdir } = require('node:os')`
 *    - `import { tmpDir } from 'os'` → `import { tmpdir } from 'os'`
 *    - `import { tmpDir } from 'node:os'` → `import { tmpdir } from 'node:os'`
 *
 * 2. Updates variable declarations that use `tmpDir`:
 *    - `const td = tmpDir()` → `const td = tmpdir()`
 *    - `let td = tmpDir()` → `let td = tmpdir()`
 *    - `var td = tmpDir()` → `var td = tmpdir()`
 *
 * 3. Preserves original variable names and declaration types.
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	let hasChanges = false;

	// Step 1: Find and update destructuring assignments from require('os') or require('node:os')
	const requireStatements = getNodeRequireCalls(root, 'os');

	for (const statement of requireStatements) {
		// Find the object pattern (destructuring)
		const objectPattern = statement.find({
			rule: {
				kind: 'object_pattern',
			},
		});

		if (objectPattern) {
			const originalText = objectPattern.text();

			if (originalText.includes('tmpDir')) {
				const newText = originalText.replace(/\btmpDir\b/g, 'tmpdir');
				edits.push(objectPattern.replace(newText));
				hasChanges = true;
			}
		}
	}

	const importStatements = getNodeImportStatements(root, 'os');

	for (const statement of importStatements) {
		// Find the named imports
		const namedImports = statement.find({
			rule: {
				kind: 'named_imports',
			},
		});

		if (namedImports) {
			const originalText = namedImports.text();

			if (originalText.includes('tmpDir')) {
				const newText = originalText.replace(/\btmpDir\b/g, 'tmpdir');
				edits.push(namedImports.replace(newText));
				hasChanges = true;
			}
		}
	}

	// Step 2: Find and replace tmpDir function calls
	const functionCalls = rootNode.findAll({
		rule: {
			pattern: 'tmpDir',
		},
	});

	for (const call of functionCalls) {
		edits.push(call.replace('tmpdir'));
		hasChanges = true;
	}

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
}
