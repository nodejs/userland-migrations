import { parse, Lang, type Edit } from "@ast-grep/napi";

export async function workflow(source: string) {
	const ast = parse(Lang.TypeScript, source);
	const root = ast.root();

	const imports = [
		"describe",
		"it",
		"test",
		"beforeEach",
		"afterEach",
		"beforeAll",
		"afterAll",
	].filter((name) => root.has(`${name}($$$_ARGS)`));
	const importStatement = `import { ${imports.join(", ").replaceAll("All", "")} } from "node:test";\n`;

	const edits: Edit[] = [];
	const addImportsEdit: Edit = { startPos: 0, endPos: 0, insertedText: importStatement };
	edits.push(addImportsEdit);

	const deleteJestImportEdits = root
		.findAll('import { $$$_NAME } from "@jest/globals"\n')
		.map((node) => {
			const edit = node.replace("");
			// FIXME: find another way to include newline
			edit.endPos++;
			return edit;
		});
	edits.push(...deleteJestImportEdits);

	const expectPresent = root.has("expect($$$_ARGS)");
	console.log("expectPresent", expectPresent);
	if (expectPresent) {
		addImportsEdit.insertedText += 'import { expect } from "expect";\n';
	}

	console.log("edits", edits);
	return root.commitEdits(edits);
}
