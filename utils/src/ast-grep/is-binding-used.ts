import type { SgNode, SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/**
 * Checks if a binding is used in the code, excluding usages within its declaration
 * and usages of specific properties.
 *
 * @param root - The root AST node
 * @param binding - The name of the binding to check
 * @param declarationNode - The node where the binding is declared (to ignore usages within it)
 * @param ignoredProperties - List of property names to ignore (e.g. ['_extend'] will ignore `binding._extend`)
 * @returns true if the binding is used elsewhere, false otherwise
 */
export const isBindingUsed = (
	root: SgRoot<Js>,
	binding: string,
	declarationNode: SgNode<Js>,
	ignoredProperties: string[] = [],
): boolean => {
	const usages = root.root().findAll({
		rule: {
			kind: 'identifier',
			pattern: binding,
		},
	});

	for (const usage of usages) {
		// Ignore usages inside the declaration node (the import statement)
		// We use range check to be safe
		const usageRange = usage.range();
		const declRange = declarationNode.range();

		if (
			usageRange.start.line >= declRange.start.line &&
			usageRange.end.line <= declRange.end.line
		) {
			continue;
		}

		const parent = usage.parent();
		if (!parent) continue;

		// Check if usage is a property access of an ignored property
		if (parent.kind() === 'member_expression') {
			const property = parent.field('property');
			if (property && ignoredProperties.includes(property.text())) {
				continue;
			}
		}

		return true;
	}

	return false;
};
