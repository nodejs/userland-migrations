import { getNodeRequireCalls } from '@nodejs/codemod-utils/ast-grep/require-call';
import { getNodeImportStatements } from '@nodejs/codemod-utils/ast-grep/import-statement';
import type { Edit, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

const patterns = ['F_OK', 'R_OK', 'W_OK', 'X_OK'];

export default function tranform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const requireStatements = getNodeRequireCalls(root, 'fs');

	for (const statement of requireStatements) {
		const objectPattern = statement.find({
			rule: { kind: 'object_pattern' },
		});

		if (objectPattern) {
			let objPatArr = objectPattern
				.findAll({
					rule: { kind: 'shorthand_property_identifier_pattern' },
				})
				.map((v) => v.text());
			objPatArr = objPatArr.filter((v) => !patterns.includes(v));
			objPatArr.push('constants');
			edits.push(objectPattern.replace(`{ ${objPatArr.join(', ')} }`));
		}
	}

	const importStatements = getNodeImportStatements(root, 'fs');
	let promisesImportName = '';

	for (const statement of importStatements) {
		const objectPattern = statement.find({
			rule: { kind: 'named_imports' },
		});

		if (objectPattern) {
			let objPatArr = objectPattern
				.findAll({
					rule: { kind: 'import_specifier' },
				})
				.map((v) => v.text());
			objPatArr = objPatArr.filter((v) => !patterns.includes(v));
			const promisesImport = objPatArr.find((v) => v.startsWith('promises'));
			if (promisesImport) {
				if (promisesImport.includes('as')) {
					const m = promisesImport.matchAll(/promises as (\w+)/g);
					m.forEach((v) => {
						promisesImportName = v[1] ?? 'promises';
					});
				} else {
					promisesImportName = promisesImport;
				}
				promisesImportName = `${promisesImportName}.`;
			} else {
				objPatArr.push('constants');
			}
			edits.push(objectPattern.replace(`{ ${objPatArr.join(', ')} }`));
		}
	}

	for (const _OK of patterns) {
		for (const [prefix, replacement] of [
			['fs.', 'fs.constants.'],
			['', `${promisesImportName ? promisesImportName : ''}constants.`],
		]) {
			const patterns = rootNode.findAll({
				rule: { pattern: `${prefix}${_OK}` },
			});
			for (const pattern of patterns) {
				edits.push(pattern.replace(`${replacement}${_OK}`));
			}
		}
	}

	return rootNode.commitEdits(edits);
}
