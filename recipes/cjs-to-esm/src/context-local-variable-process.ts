import type { SgRoot, Edit, SgNode } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

/**
 * Returns true when `__dirname` or `__filename` resolves to a local definition
 * in the current file and should not be transformed.
 *
 * @example
 * // true for: const __dirname = '/tmp';
 * isShadowedContextLocal(identifier, root)
 *
 * @example
 * // true for: function fn(__filename) { return __filename; }
 * isShadowedContextLocal(identifier, root)
 *
 * @example
 * // false when using Node.js global `__dirname` with no local binding
 * isShadowedContextLocal(identifier, root)
 */
const isShadowedContextLocal = (
	node: SgNode<JS>,
	root: SgRoot<JS>,
): boolean => {
	const definition = node.definition();

	if (!definition || definition.kind !== 'local') return false;

	return definition.root.filename() === root.filename();
};

/**
 * @see https://github.com/nodejs/package-examples/blob/main/guide/05-cjs-esm-migration/migrating-context-local-variables/README.md
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const requireMainNodes = rootNode.findAll({
		rule: {
			kind: 'member_expression',
			has: {
				field: 'object',
				kind: 'identifier',
				regex: '^require$',
			},
			all: [
				{
					has: {
						field: 'property',
						kind: 'property_identifier',
						regex: '^main$',
					},
				},
			],
		},
	});

	for (const node of requireMainNodes) {
		const result = node.find({
			rule: {
				inside: {
					kind: 'binary_expression',
					has: {
						kind: 'identifier',
						regex: 'module',
					},
				},
			},
		});

		edits.push((result ?? node).replace('import.meta.main'));
	}

	const requireResolveNodes = rootNode.findAll({
		rule: {
			kind: 'call_expression',
			has: {
				field: 'function',
				kind: 'member_expression',
				all: [
					{
						has: {
							field: 'object',
							kind: 'identifier',
							regex: '^require$',
						},
					},
					{
						has: {
							field: 'property',
							kind: 'property_identifier',
							regex: '^resolve$',
						},
					},
				],
			},
		},
	});

	for (const node of requireResolveNodes) {
		const args = node.field('arguments');
		if (args) edits.push(node.replace(`import.meta.resolve${args.text()}`));
	}

	const contextLocalIdentifiers = rootNode.findAll({
		rule: {
			kind: 'identifier',
			regex: '^(__filename|__dirname)$',
		},
	});

	for (const identifier of contextLocalIdentifiers) {
		if (isShadowedContextLocal(identifier, root)) continue;
		const name = identifier.text();

		switch (name) {
			case '__dirname':
				edits.push(identifier.replace('import.meta.dirname'));
				break;
			case '__filename':
				edits.push(identifier.replace('import.meta.filename'));
				break;
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}
