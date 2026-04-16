import { updateBinding } from '@nodejs/codemod-utils/ast-grep/update-binding';
import { removeLines } from '@nodejs/codemod-utils/ast-grep/remove-lines';
import { getScope } from '@nodejs/codemod-utils/ast-grep/get-scope';
import type { Edit, SgRoot, Range, SgNode } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import { getModuleDependencies } from '@nodejs/codemod-utils/ast-grep/module-dependencies';

export default function transform(root: SgRoot<Js>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	const importNodes = getModuleDependencies(root, 'tls');

	for (const node of importNodes) {
		// Update any binding that imports SecurePair -> TLSSocket (e.g. import { SecurePair })
		const change = updateBinding(node, { old: 'SecurePair', new: 'TLSSocket' });
		if (change?.edit) edits.push(change.edit);
		if (change?.lineToRemove) linesToRemove.push(change.lineToRemove);
	}

	const newExpressions = rootNode.findAll({
		rule: {
			kind: 'new_expression',
			has: {
				any: [
					{
						kind: 'member_expression',
						has: { field: 'property', regex: '^SecurePair$' },
					},
					{ kind: 'identifier', pattern: 'SecurePair' },
				],
			},
		},
	});

	for (const node of newExpressions) {
		const callee = node.field('constructor');
		if (!callee) continue;

		let newConstructorName = 'TLSSocket';
		if (callee.kind() === 'member_expression') {
			const object = callee.field('object');
			if (object) {
				newConstructorName = `${object.text()}.TLSSocket`;
			}
		}

		// Replace the constructor call with `new TLSSocket(socket)`.
		edits.push(node.replace(`new ${newConstructorName}(socket)`));
		const declarator = node.find({
			rule: {
				inside: {
					kind: 'variable_declarator',
					stopBy: 'end',
				},
			},
		});

		if (declarator) {
			const idNode = declarator.field('name');
			if (idNode) {
				const oldName = idNode.text();
				let newName = 'socket';
				if (oldName !== 'pair' && oldName !== 'SecurePair') {
					if (oldName.includes('Pair'))
						newName = oldName.replace('Pair', 'Socket');
					else if (oldName.includes('pair'))
						newName = oldName.replace('pair', 'socket');
				}

				// Find usages like `pair.cleartext` or `pair.encrypted` to remove those
				// statements as they don't apply to TLSSocket-based code.
				const obsoleteUsages = rootNode.findAll({
					rule: {
						kind: 'member_expression',
						all: [
							{ has: { field: 'object', regex: `^${oldName}$` } },
							{ has: { field: 'property', regex: '^(cleartext|encrypted)$' } },
						],
					},
				});
				for (const usage of obsoleteUsages) {
					const statement = usage.find({
						rule: {
							any: [
								{
									inside: {
										kind: 'lexical_declaration',
										stopBy: 'end',
									},
								},
								{
									inside: {
										kind: 'expression_statement',
										stopBy: 'end',
									},
								},
							],
						},
					});
					if (statement) linesToRemove.push(statement.range());
				}

				// Rename the variable (e.g. `pair` -> `socket`) and update references.
				edits.push(idNode.replace(newName));
				const references = idNode.references();

				// Update all references, skipping property accesses and imports.
				for (const refs of references) {
					for (const node of refs.nodes) {
						edits.push(node.replace(newName));
					}
				}
			}
		}
	}

	const sourceCode = rootNode.commitEdits(edits);

	let output = removeLines(sourceCode, linesToRemove) ?? '';
	// Normalize newlines and trim trailing whitespace for predictable snapshots.
	output = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	output = output.replace(/(^.*\S)[ \t]+$/gm, '$1');
	output = output.replace(/^\uFEFF/, '');

	const eol =
		typeof process !== 'undefined' && process.platform === 'win32'
			? '\r\n'
			: '\n';
	output = output.replace(/\n/g, eol);
	if (output.endsWith(eol)) output = output.slice(0, -eol.length);

	return output;
}
