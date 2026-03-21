import type { SgRoot, Edit, SgNode } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

/**
 * @see https://github.com/nodejs/package-examples/blob/main/guide/05-cjs-esm-migration/migrating-context-local-variables/README.md
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const seenRanges = new Set<string>();

	const pushEdit = (edit: Edit) => {
		const key = `${edit.startPos}:${edit.endPos}`;
		if (seenRanges.has(key)) {
			return;
		}

		seenRanges.add(key);
		edits.push(edit);
	};

	const addPatternReplacements = (
		pattern: string,
		replacement: string,
	) => {
		const nodes = rootNode.findAll({
			rule: {
				pattern,
			},
		});

		for (const node of nodes) {
			pushEdit(node.replace(replacement));
		}
	};

	const isRequireMainComparison = (node: SgNode<JS>): boolean =>
		node.inside({
			rule: {
				any: [
					{
						pattern: 'require.main === module',
					},
					{
						pattern: 'module === require.main',
					},
				],
			},
		});

	const isShadowedContextLocal = (node: SgNode<JS>): boolean => {
		const definition = node.definition();

		if (!definition) {
			return false;
		}

		if (definition.kind !== 'local') {
			return false;
		}

		return definition.root.filename() === root.filename();
	};

	addPatternReplacements('require.main === module', 'import.meta.main');
	addPatternReplacements('module === require.main', 'import.meta.main');

	const requireMainNodes = rootNode.findAll({
		rule: {
			pattern: 'require.main',
		},
	});

	for (const node of requireMainNodes) {
		if (isRequireMainComparison(node)) {
			continue;
		}

		pushEdit(node.replace('import.meta.main'));
	}

	const requireResolveNodes = rootNode.findAll({
		rule: {
			pattern: 'require.resolve($$$ARGS)',
		},
	});

	for (const node of requireResolveNodes) {
		const args = node.field('arguments');
		if (!args) {
			continue;
		}

		pushEdit(node.replace(`import.meta.resolve${args.text()}`));
	}

	const contextLocalIdentifiers = rootNode.findAll({
		rule: {
			kind: 'identifier',
			regex: '^(__filename|__dirname)$',
		},
	});

	for (const identifier of contextLocalIdentifiers) {
		if (isShadowedContextLocal(identifier)) {
			continue;
		}

		if (identifier.text() === '__filename') {
			pushEdit(identifier.replace('import.meta.filename'));
		}

		if (identifier.text() === '__dirname') {
			pushEdit(identifier.replace('import.meta.dirname'));
		}
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}
