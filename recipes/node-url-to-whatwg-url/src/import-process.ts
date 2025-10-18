import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import type { SgRoot, Edit, SgNode, Range } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

// Heuristic: declaration counts as one; any other usage yields > 1
const isBindingUsed = (rootNode: SgNode<JS>, name: string): boolean =>
	rootNode.findAll({ rule: { pattern: name } }).length > 1;

/**
 * Clean up unused imports/requires from 'node:url' after transforms using shared utils
 */
export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	const linesToRemove: Range[] = [];

	// 1) ES Module imports: import ... from 'node:url'
	const esmImports = getNodeImportStatements(root, "url");

	for (const imp of esmImports) {
		const clause = imp.find({ rule: { kind: "import_clause" } });
		let removed = false;

		if (clause) {
			const nsId = clause.find({ rule: { kind: "namespace_import" } })?.find({ rule: { kind: "identifier" } });

			if (nsId && !isBindingUsed(rootNode, nsId.text())) {
				linesToRemove.push(imp.range());
				removed = true;
			}

			if (removed) continue;

			const specs = clause.findAll({ rule: { kind: "import_specifier" } });

			if (specs.length === 0 && !nsId) {
				const defaultId = clause.find({ rule: { kind: "identifier" } });
				if (defaultId && !isBindingUsed(rootNode, defaultId.text())) {
					linesToRemove.push(imp.range());
					removed = true;
				}
				if (removed) continue;
			}

			if (specs.length > 0) {
				const keepTexts: string[] = [];
				for (const spec of specs) {
					const text = spec.text().trim();
					const bindingName = text.includes(" as ") ? text.split(/\s+as\s+/)[1] : text;
					if (bindingName && isBindingUsed(rootNode, bindingName)) keepTexts.push(text);
				}
				if (keepTexts.length === 0) {
					linesToRemove.push(imp.range());
				} else if (keepTexts.length !== specs.length) {
					const namedImportsNode = clause.find({ rule: { kind: "named_imports" } });
					if (namedImportsNode) edits.push(namedImportsNode.replace(`{ ${keepTexts.join(", ")} }`));
				}
			}
		}
	}

	// 2) CommonJS requires: const ... = require('node:url')
	const requireDecls = getNodeRequireCalls(root, "url");

	for (const decl of requireDecls) {
		const id = decl.find({ rule: { kind: "identifier" } });
		const hasObjectPattern = decl.find({ rule: { kind: "object_pattern" } });

		if (id && !hasObjectPattern) {
			if (!isBindingUsed(rootNode, id.text())) linesToRemove.push(decl.parent().range());
			continue;
		}

		if (hasObjectPattern) {
			const names: string[] = [];
			const shorts = decl.findAll({
				rule: { kind: "shorthand_property_identifier_pattern" }
			});

			for (const s of shorts) names.push(s.text());

			const pairs = decl.findAll({ rule: { kind: "pair_pattern" } });

			for (const pair of pairs) {
				const aliasId = pair.find({ rule: { kind: "identifier" } });

				if (aliasId) names.push(aliasId.text());
			}

			const usedTexts: string[] = [];
			for (const s of shorts) {
				if (isBindingUsed(rootNode, s.text())) usedTexts.push(s.text());
			}

			for (const pair of pairs) {
				const aliasId = pair.find({ rule: { kind: "identifier" } });

				if (aliasId && isBindingUsed(rootNode, aliasId.text())) usedTexts.push(pair.text());
			}

			if (usedTexts.length === 0) {
				linesToRemove.push(decl.parent().range());
			} else if (usedTexts.length !== names.length) {
				const objPat = decl.find({ rule: { kind: "object_pattern" } });

				if (objPat) edits.push(objPat.replace(`{ ${usedTexts.join(", ")} }`));
			}
		}
	}

	if (edits.length === 0 && linesToRemove.length === 0) return null;

	const source = rootNode.commitEdits(edits);

	return removeLines(source, linesToRemove);
};
