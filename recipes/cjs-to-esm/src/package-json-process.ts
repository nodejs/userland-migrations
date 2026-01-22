import type { Edit, SgRoot, SgNode } from '@codemod.com/jssg-types/main';
import type Json from '@codemod.com/jssg-types/langs/json';

const TARGET_NODE_TEXT = '"node": "^20.19.0 || >=22.12.0"';

// in future, I (@AugustinMauroy) want to use `@vlt/semver` to compare versions properly
function rebuildEnginesText(node: SgNode<Json>): {
	text: string;
	changed: boolean;
} {
	const existingText = node.text().trim();
	const valueNode = node.child(2);
	if (!valueNode?.is('object')) return { text: existingText, changed: false };

	const innerChildren = valueNode.children();
	const innerPairs: SgNode<Json>[] = [];
	for (const ic of innerChildren) if (ic.is('pair')) innerPairs.push(ic);

	const innerTexts: string[] = [];
	let nodePresent = false;
	let nodeUpdated = false;

	for (const ip of innerPairs) {
		const keyNode = ip.child(0);
		if (!keyNode) continue;
		const name = keyNode.text().replace(/^"|"$/g, '');
		const trimmed = ip.text().trim();

		if (name === 'node') {
			nodePresent = true;
			if (trimmed !== TARGET_NODE_TEXT) nodeUpdated = true;
			innerTexts.push(TARGET_NODE_TEXT);
		} else {
			innerTexts.push(trimmed);
		}
	}

	if (!nodePresent || !nodeUpdated)
		return { text: existingText, changed: false };

	const newValue = `{\n    ${innerTexts.join(',\n    ')}\n  }`;

	return { text: `"engines": ${newValue}`, changed: true };
}

/**
 * @see https://github.com/nodejs/package-examples/tree/main/guide/05-cjs-esm-migration/migrating-package-json
 */
export default function transform(root: SgRoot<Json>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];

	const mainObject = rootNode.find({
		rule: { kind: 'object', inside: { kind: 'document' } },
	});

	// if no main object, means not a valid package.json
	if (!mainObject) return null;

	const childNodes = mainObject.children();
	const topPairs: SgNode<Json>[] = [];
	for (const c of childNodes) if (c.is('pair')) topPairs.push(c);

	const existing: Record<string, SgNode<Json>> = {};
	const orderedKeys: string[] = [];
	for (const p of topPairs) {
		const keyNode = p.child(0);
		if (!keyNode) continue;
		const keyText = keyNode.text().replace(/^"|"$/g, '');
		existing[keyText] = p;
		orderedKeys.push(keyText);
	}

	const pairTexts: string[] = [];
	let enginesChanged = false;

	for (const k of orderedKeys) {
		if (k === 'engines') {
			const { text, changed } = rebuildEnginesText(existing[k]);
			pairTexts.push(text);
			if (changed) enginesChanged = true;
		} else {
			pairTexts.push(existing[k].text().trim());
		}
	}

	const typeMissing = !('type' in existing);
	if (!typeMissing && !enginesChanged) return null;

	if (typeMissing) pairTexts.push('"type": "module"');

	const newObjText = `{\n  ${pairTexts.join(',\n  ')}\n}\n`;
	edits.push(mainObject.replace(newObjText));

	return rootNode.commitEdits(edits);
}
