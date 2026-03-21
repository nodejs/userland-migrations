import type { SgRoot, Edit, SgNode } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

const isRequireMainMemberExpression = (node: SgNode<JS>): boolean => {
	if (!node.is('member_expression')) return false;


	const object = node.field('object');
	const property = node.field('property');

	if (!object || !property) return false;

	return (
		object.is('identifier') &&
		object.text() === 'require' &&
		property.is('property_identifier') &&
		property.text() === 'main'
	);
};

const isModuleIdentifier = (node: SgNode<JS>): boolean =>
	node.is('identifier') && node.text() === 'module';

const isRequireMainComparison = (node: SgNode<JS>): boolean => {
	if (!node.is('binary_expression')) return false;


	const left = node.child(0);
	const operator = node.child(1);
	const right = node.child(2);

	if (!left || !operator || !right || operator.text() !== '===') {
		return false;
	}

	return (
		(isRequireMainMemberExpression(left) && isModuleIdentifier(right)) ||
		(isModuleIdentifier(left) && isRequireMainMemberExpression(right))
	);
};

const isShadowedContextLocal = (node: SgNode<JS>, root: SgRoot<JS>): boolean => {
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

	const requireMainComparisons = rootNode.findAll({
		rule: {
			kind: 'binary_expression',
		},
	});

	for (const comparison of requireMainComparisons) {
		if (!isRequireMainComparison(comparison)) continue;

		edits.push(comparison.replace('import.meta.main'));
	}

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
		if (node.ancestors().some((ancestor) => isRequireMainComparison(ancestor))) {
			continue;
		}

		edits.push(node.replace('import.meta.main'));
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
		if (!args) continue;

		edits.push(node.replace(`import.meta.resolve${args.text()}`));
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
			case '__filename':
				edits.push(identifier.replace('import.meta.filename'));
				break;
			case '__dirname':
				edits.push(identifier.replace('import.meta.dirname'));
				break;
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}
