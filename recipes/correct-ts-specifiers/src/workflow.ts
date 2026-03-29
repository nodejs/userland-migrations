import type { Edit, SgRoot, SgNode } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

import { mapImports } from './map-imports.ts';
import type { FSAbsolutePath } from './index.d.ts';

export default async function transform(
	root: SgRoot<Js>,
): Promise<string | null> {
	const rootNode = root.root();
	const filepath = root.filename() as FSAbsolutePath;
	const edits: Edit[] = [];

	const statements = rootNode.findAll({
		rule: {
			any: [
				{ kind: 'import_statement' },
				{ kind: 'export_statement', has: { kind: 'string' } },
				{ pattern: 'import("$$$_")' },
				{ pattern: "import('$$$_')" },
			],
		},
	});

	for (const statement of statements) {
		const statementEdit = await maybeUpdateStatement(statement, filepath);
		if (statementEdit) edits.push(statementEdit);
	}

	if (!edits.length) return null;

	return rootNode.commitEdits(edits);
}

async function maybeUpdateStatement(
	statement: SgNode<Js>,
	filepath: FSAbsolutePath,
): Promise<Edit | null> {
	const importSpecifier = statement.find({
		rule: {
			kind: 'string_fragment',
			inside: { kind: 'string' },
		},
	});

	if (!importSpecifier) return null;

	const original = importSpecifier.text();
	const { isType, replacement } = await mapImports(filepath, original);

	if (!replacement) return null;

	const statementEdits: Edit[] = [];
	if (replacement !== original)
		statementEdits.push(importSpecifier.replace(replacement));

	if (isType && !statement.children().some((node) => node.kind() === 'type')) {
		const clause = statement.find({
			rule: {
				any: [{ kind: 'import_clause' }, { kind: 'export_clause' }],
			},
		});

		if (clause) statementEdits.push(clause.replace(`type ${clause.text()}`));
	}

	if (!statementEdits.length) return null;

	return statement.replace(statement.commitEdits(statementEdits));
}
