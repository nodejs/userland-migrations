import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { resolveBindingPath } from '@nodejs/codemod-utils/ast-grep/resolve-binding-path';
import type { SgRoot, Edit } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/**
 * Transform function that converts deprecated fs.rmdir calls
 * with recursive: true option to the new fs.rm API.
 *
 * Handles:
 * 1. fs.rmdir(path, { recursive: true }, callback) → fs.rm(path, { recursive: true, force: true }, callback)
 * 2. fs.rmdir(path, { recursive: true }) → fs.rm(path, { recursive: true, force: true })
 * 3. fs.rmdirSync(path, { recursive: true }) → fs.rmSync(path, { recursive: true, force: true })
 * 4. fs.promises.rmdir(path, { recursive: true }) → fs.promises.rm(path, { recursive: true, force: true })
 */
export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	// Find all rmdir calls that need transformation
	const rmdirSyncCalls = rootNode.findAll({
		rule: {
			any: [
				{ pattern: 'fs.rmdirSync($PATH, $OPTIONS)' },
				{ pattern: 'rmdirSync($PATH, $OPTIONS)' },
			],
		},
	});

	const rmdirCalls = rootNode.findAll({
		rule: {
			any: [
				{ pattern: 'fs.rmdir($PATH, $OPTIONS, $CALLBACK)' },
				{ pattern: 'fs.rmdir($PATH, $OPTIONS)' },
				{ pattern: 'rmdir($PATH, $OPTIONS, $CALLBACK)' },
				{ pattern: 'rmdir($PATH, $OPTIONS)' },
			],
		},
	});

	const promisesRmdirCalls = rootNode.findAll({
		rule: {
			any: [
				{ pattern: 'fs.promises.rmdir($PATH, $OPTIONS)' },
				{ pattern: 'promises.rmdir($PATH, $OPTIONS)' },
			],
		},
	});

	let needsRmImport = false;
	let needsRmSyncImport = false;

	// Transform rmdirSync calls
	for (const call of rmdirSyncCalls) {
		const optionsMatch = call.getMatch('OPTIONS');
		if (!optionsMatch) continue;
		const optionsText = optionsMatch.text();
		if (!optionsText.includes('recursive') || !optionsText.includes('true')) {
			continue;
		}

		const path = call.getMatch('PATH')?.text();
		const callText = call.text();

		if (callText.includes('fs.rmdirSync(')) {
			const newCallText = `fs.rmSync(${path}, { recursive: true, force: true })`;
			edits.push(call.replace(newCallText));
		} else {
			// destructured call like rmdirSync(...)
			const newCallText = `rmSync(${path}, { recursive: true, force: true })`;
			edits.push(call.replace(newCallText));
			needsRmSyncImport = true;
		}
	}

	// Transform rmdir calls
	for (const call of rmdirCalls) {
		const optionsMatch = call.getMatch('OPTIONS');
		if (!optionsMatch) continue;
		const optionsText = optionsMatch.text();
		if (!optionsText.includes('recursive') || !optionsText.includes('true')) {
			continue;
		}

		const path = call.getMatch('PATH')?.text();
		const callText = call.text();

		if (callText.includes('fs.rmdir(')) {
			// Handle fs.rmdir → fs.rm
			if (call.getMatch('CALLBACK')) {
				// Has callback
				const callback = call.getMatch('CALLBACK')?.text();
				const newCallText = `fs.rm(${path}, { recursive: true, force: true }, ${callback})`;
				edits.push(call.replace(newCallText));
			} else {
				// No callback
				const newCallText = `fs.rm(${path}, { recursive: true, force: true })`;
				edits.push(call.replace(newCallText));
			}
		} else {
			// destructured call like rmdir(...)
			if (call.getMatch('CALLBACK')) {
				// Has callback
				const callback = call.getMatch('CALLBACK')?.text();
				const newCallText = `rm(${path}, { recursive: true, force: true }, ${callback})`;
				edits.push(call.replace(newCallText));
			} else {
				// No callback
				const newCallText = `rm(${path}, { recursive: true, force: true })`;
				edits.push(call.replace(newCallText));
			}
			needsRmImport = true;
		}
	}

	// Transform fs.promises.rmdir calls
	for (const call of promisesRmdirCalls) {
		const optionsMatch = call.getMatch('OPTIONS');
		if (!optionsMatch) continue;
		const optionsText = optionsMatch.text();
		if (!optionsText.includes('recursive') || !optionsText.includes('true')) {
			continue;
		}

		const path = call.getMatch('PATH')?.text();
		const callText = call.text();

		if (callText.includes('fs.promises.rmdir(')) {
			const newCallText = `fs.promises.rm(${path}, { recursive: true, force: true })`;
			edits.push(call.replace(newCallText));
		} else {
			// destructured call like promises.rmdir(...)
			const newCallText = `promises.rm(${path}, { recursive: true, force: true })`;
			edits.push(call.replace(newCallText));
			needsRmImport = true;
		}
	}

	// Transform named alias import when recursive set to true
	const importStatements = getNodeImportStatements(root, 'fs');

	for (const eachNode of importStatements) {
		// Get in file reference alias name (import {rmdir as foo} from "node:fs" → foo)
		const referenceNameInFile = resolveBindingPath(eachNode, '$.rmdir');
		if (!referenceNameInFile) continue;
		// Get in file reference node
		const referenceFunctionNode = rootNode.find({
			rule: {
				any: [
					{
						pattern: `${referenceNameInFile}($PATH, $OPTIONS, $CALLBACK)`,
					},
					{
						pattern: `${referenceNameInFile}($PATH, $OPTIONS)`,
					},
				],
			},
		});
		if (!referenceFunctionNode) continue;
		const optionsMatch = referenceFunctionNode.getMatch('OPTIONS');
		if (!optionsMatch) continue;
		const optionsText = optionsMatch.text();
		if (!optionsText.includes('recursive') || !optionsText.includes('true')) {
			continue;
		}
		// Proceed with the change since { recursive: true }
		const aliasNodes = eachNode.findAll({
			rule: {
				any: [
					{
						kind: 'import_specifier',
						all: [
							{
								has: {
									field: 'alias',
									pattern: '$ALIAS',
								},
							},
							{
								has: {
									field: 'name',
									pattern: '$ORIGINAL',
								},
							},
						],
					},
				],
			},
		});

		for (const eachAliasNode of aliasNodes) {
			// Narrow down to rmdir alias
			if (eachAliasNode.text().includes('rmdir')) {
				const rmdirNode = eachAliasNode.find({
					rule: {
						pattern: 'rmdir',
						kind: 'identifier',
					},
				});
				// Change rmdir to rm
				edits.push(rmdirNode!.replace('rm'));
			}
		}
	}

	// Update imports/requires only if we have destructured calls that need new imports
	if (needsRmImport || needsRmSyncImport) {
		const importStatements = getNodeImportStatements(root, 'fs');

		// Update import statements
		for (const importNode of importStatements) {
			// Check if it's a named import (destructured)
			const namedImports = importNode.find({ rule: { kind: 'named_imports' } });
			if (!namedImports) continue;

			let importText = importNode.text();
			let updated = false;

			if (
				needsRmImport &&
				importText.includes('rmdir') &&
				!importText.includes(' rm,') &&
				!importText.includes(' rm ') &&
				!importText.includes('{rm,') &&
				!importText.includes('{rm }')
			) {
				// Add rm to imports
				importText = importText.replace(/{\s*/, '{ rm, ');
				updated = true;
			}

			if (needsRmSyncImport && importText.includes('rmdirSync')) {
				// Replace rmdirSync with rmSync
				importText = importText.replace(/rmdirSync/g, 'rmSync');
				updated = true;
			}

			if (updated) {
				edits.push(importNode.replace(importText));
			}
		}

		const requireStatements = getNodeRequireCalls(root, 'fs');

		// Update require statements
		for (const requireNode of requireStatements) {
			let requireText = requireNode.text();
			let updated = false;

			if (
				needsRmImport &&
				requireText.includes('rmdir') &&
				!requireText.includes(' rm,') &&
				!requireText.includes(' rm ') &&
				!requireText.includes('{rm,') &&
				!requireText.includes('{rm }')
			) {
				// Add rm to requires
				requireText = requireText.replace(/{\s*/, '{ rm, ');
				updated = true;
			}

			if (needsRmSyncImport && requireText.includes('rmdirSync')) {
				// Replace rmdirSync with rmSync
				requireText = requireText.replace(/rmdirSync/g, 'rmSync');
				updated = true;
			}

			if (updated) {
				edits.push(requireNode.replace(requireText));
			}
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}
