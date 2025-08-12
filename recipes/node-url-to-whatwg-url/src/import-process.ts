import type { SgRoot, Edit, Range } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
// Clean up unused imports/requires from 'node:url' after transforms using shared utils

export default function transform(root: SgRoot<JS>): string | null {
	const rootNode = root.root();
	const edits: Edit[] = [];
	let hasChanges = false;

	// after the migration, replacement of `url.parse` and `url.format`
	// we need to check remaining usage of `url` module
	// if needed, we can remove the `url` import
	// we are going to use bruno's utility to resolve bindings

	const isBindingUsed = (name: string): boolean => {
		const refs = rootNode.findAll({ rule: { pattern: name } });
		// Heuristic: declaration counts as one; any other usage yields > 1
		return refs.length > 1;
	};

	const linesToRemove: Range[] = [];

	// 1) ES Module imports: import ... from 'node:url'
	// @ts-ignore - ast-grep types vs jssg types
	const esmImports = getNodeImportStatements(root, "url");

	for (const imp of esmImports) {
		// Try namespace/default binding
		const clause = imp.find({ rule: { kind: "import_clause" } });
		let removed = false;
		if (clause) {
			// Namespace import like: import * as url from 'node:url'
			const nsId = clause.find({ rule: { kind: "namespace_import" } })?.find({ rule: { kind: "identifier" } });
			if (nsId && !isBindingUsed(nsId.text())) {
				edits.push(imp.replace(""));
				removed = true;
			}
			if (removed) continue;

			// Named imports bucket
			const specs = clause.findAll({ rule: { kind: "import_specifier" } });

			// Default import like: import url from 'node:url' (only when not a named or namespace import)
			if (specs.length === 0 && !nsId) {
				const defaultId = clause.find({ rule: { kind: "identifier" } });
				if (defaultId && !isBindingUsed(defaultId.text())) {
					edits.push(imp.replace(""));
					removed = true;
				}
				if (removed) continue;
			}

			// Named imports: import { a, b as c } from 'node:url'
			if (specs.length > 0) {
				const keepTexts: string[] = [];
				for (const spec of specs) {
					const text = spec.text().trim();
					// If alias form exists, use alias as the binding name
					const bindingName = text.includes(" as ") ? text.split(/\s+as\s+/)[1] : text;
					if (bindingName && isBindingUsed(bindingName)) keepTexts.push(text);
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
	// @ts-ignore - ast-grep types vs jssg types
	const requireDecls = getNodeRequireCalls(root, "url");

	for (const decl of requireDecls) {
		// Namespace require: const url = require('node:url')
		const id = decl.find({ rule: { kind: "identifier" } });
		const hasObjectPattern = decl.find({ rule: { kind: "object_pattern" } });

		if (id && !hasObjectPattern) {
			if (!isBindingUsed(id.text())) linesToRemove.push(decl.parent().range());
			continue;
		}

		// Destructured require: const { parse, format: fmt } = require('node:url')
		if (hasObjectPattern) {
			const names: string[] = [];
			// Shorthand bindings
			const shorts = decl.findAll({ rule: { kind: "shorthand_property_identifier_pattern" } });
			for (const s of shorts) names.push(s.text());
			// Aliased bindings (pair_pattern) => use the identifier name (value)
			const pairs = decl.findAll({ rule: { kind: "pair_pattern" } });
			for (const pair of pairs) {
				const aliasId = pair.find({ rule: { kind: "identifier" } });
				if (aliasId) names.push(aliasId.text());
			}

			const usedTexts: string[] = [];
			for (const s of shorts) if (isBindingUsed(s.text())) usedTexts.push(s.text());
			for (const pair of pairs) {
				const aliasId = pair.find({ rule: { kind: "identifier" } });
				if (aliasId && isBindingUsed(aliasId.text())) usedTexts.push(pair.text()); // keep full spec text
			}

			if (usedTexts.length === 0) {
				linesToRemove.push(decl.parent().range());
			} else if (usedTexts.length !== names.length) {
				const objPat = decl.find({ rule: { kind: "object_pattern" } });
				if (objPat) edits.push(objPat.replace(`{ ${usedTexts.join(", ")} }`));
			}
		}
	}

	hasChanges = edits.length > 0 || linesToRemove.length > 0;

	if (!hasChanges) return null;

	// Apply edits, remove whole lines ranges, then normalize leading whitespace only
	let source = rootNode.commitEdits(edits);
	source = removeLines(source, linesToRemove);
	source = source.replace(/^\n+/, "");
	return source;
};

