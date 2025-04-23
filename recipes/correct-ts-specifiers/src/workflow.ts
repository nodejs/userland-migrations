import module from 'node:module';

import { type Api, api } from '@codemod.com/workflow';
import type { Helpers } from '@codemod.com/workflow/dist/jsFam.d.ts';

import { mapImports } from './map-imports.ts';
import type { FSAbsolutePath } from './index.d.ts';

import * as aliasLoader from '@nodejs-loaders/alias/alias.loader.mjs';

module.registerHooks(aliasLoader);

export async function workflow({ contexts, files }: Api) {
	await files(globPattern).jsFam(processModule);

	async function processModule({ astGrep }: Helpers) {
		const filepath = contexts.getFileContext().file as FSAbsolutePath;

		await astGrep({
			rule: {
				any: [
					{ kind: 'import_statement' },
					{ kind: 'export_statement', has: { kind: 'string' } },
					{ pattern: 'import("$$$_")' },
					{ pattern: "import('$$$_')" },
				],
			},
		}).replace(async ({ getNode }) => {
			const statement = getNode();
			const importSpecifier = statement.find({
				rule: {
					kind: 'string_fragment',
					inside: { kind: 'string' },
				},
			});

			if (!importSpecifier) return;

			const { isType, replacement } = await mapImports(filepath, importSpecifier.text());

			if (!replacement) return;

			const edits = [importSpecifier.replace(replacement)];

			if (isType && !statement.children().some((node) => node.kind() === 'type')) {
				const clause = statement.find({
					rule: {
						any: [{ kind: 'import_clause' }, { kind: 'export_clause' }],
					},
				});

				if (clause) edits[1] = clause.replace(`type ${clause.text()}`);
			}

			return statement.commitEdits(edits);
		});
	}
}

const globPattern = '**/*.{cjs,mjs,js,jsx,?(d.)cts,?(d.)mts,?(d.)ts,tsx}';

workflow(api);
