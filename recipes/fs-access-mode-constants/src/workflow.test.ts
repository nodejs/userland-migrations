import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import astGrep from '@ast-grep/napi';
import type Js from '@codemod.com/jssg-types/langs/javascript';
import type { Edit, SgRoot } from '@codemod.com/jssg-types/main';
import {
	escapeRegExp,
	isAccessModeConstant,
	applyNamespaceReplacements,
	applyLocalReplacements,
	rewriteCollectedBindings,
	rewriteNamedImports,
} from './workflow.ts';

function parseRoot(source: string): SgRoot<Js> {
	return astGrep.js.parse(source) as SgRoot<Js>;
}

function commitSingleEdit(
	source: string,
	edit: ReturnType<SgRoot<Js>['root']>['replace'],
): string {
	const root = parseRoot(source);
	return root.root().commitEdits([edit]);
}

/**
 * NOTE: we don't test the main transform function here since it already tested
 * with jssg test runner. we only test the utility functions that are not directly tested by jss
 */

describe('workflow utilities', { concurrency: true }, () => {
	it('detects fs access mode constants', () => {
		assert.equal(isAccessModeConstant('F_OK'), true);
		assert.equal(isAccessModeConstant('R_OK'), true);
		assert.equal(isAccessModeConstant('W_OK'), true);
		assert.equal(isAccessModeConstant('X_OK'), true);
	});

	it('ignores non access mode constants', () => {
		assert.equal(isAccessModeConstant('constants'), false);
		assert.equal(isAccessModeConstant('f_ok'), false);
		assert.equal(isAccessModeConstant(''), false);
	});

	it('escapes regex metacharacters', () => {
		const source = '^foo.bar$(baz)[qux]{zip}|+*?\\';
		const escaped =
			'\\^foo\\.bar\\$\\(baz\\)\\[qux\\]\\{zip\\}\\|\\+\\*\\?\\\\';

		assert.equal(escapeRegExp(source), escaped);
	});

	it('leaves plain text untouched', () => {
		assert.equal(escapeRegExp('plain_text-123'), 'plain_text-123');
	});

	it('rewrites single removed named import and tracks mapping', () => {
		const source = "import { F_OK, readFile } from 'node:fs';";
		const root = parseRoot(source);
		const statement = root.root().find({
			rule: { kind: 'import_statement' },
		});
		const pattern = root.root().find({
			rule: { kind: 'named_imports' },
		});

		assert.ok(statement);
		assert.ok(pattern);

		const result = rewriteNamedImports(statement, pattern, '');

		assert.equal(result.edits.length, 1);
		assert.deepEqual(result.mappings, [
			{ local: 'F_OK', replacement: 'constants.F_OK' },
		]);
		assert.equal(
			root.root().commitEdits(result.edits),
			"import { readFile, constants } from 'node:fs';",
		);
	});

	it('rewrites aliased named import with promises binding mapping', () => {
		const source = "import { F_OK as mode, readFile } from 'node:fs';";
		const root = parseRoot(source);
		const statement = root.root().find({
			rule: { kind: 'import_statement' },
		});
		const pattern = root.root().find({
			rule: { kind: 'named_imports' },
		});

		assert.ok(statement);
		assert.ok(pattern);

		const result = rewriteNamedImports(statement, pattern, 'fs.promises');

		assert.equal(result.edits.length, 1);
		assert.deepEqual(result.mappings, [
			{ local: 'mode', replacement: 'fs.promises.constants.F_OK' },
		]);
		assert.equal(
			root.root().commitEdits(result.edits),
			"import { readFile } from 'node:fs';",
		);
	});

	it('returns no rewrite when nothing is removed', () => {
		const source = "import { readFile } from 'node:fs';";
		const root = parseRoot(source);
		const statement = root.root().find({
			rule: { kind: 'import_statement' },
		});
		const pattern = root.root().find({
			rule: { kind: 'named_imports' },
		});

		assert.ok(statement);
		assert.ok(pattern);

		const result = rewriteCollectedBindings({
			statement,
			pattern,
			promisesBinding: '',
			kept: ['readFile'],
			removed: [],
		});

		assert.deepEqual(result, { edits: [], mappings: [] });
	});

	it('rewrites collected bindings for multiple removals', () => {
		const source = "import { F_OK, R_OK, readFile } from 'node:fs';";
		const root = parseRoot(source);
		const statement = root.root().find({
			rule: { kind: 'import_statement' },
		});
		const pattern = root.root().find({
			rule: { kind: 'named_imports' },
		});

		assert.ok(statement);
		assert.ok(pattern);

		const result = rewriteCollectedBindings({
			statement,
			pattern,
			promisesBinding: '',
			kept: ['readFile'],
			removed: [
				{ imported: 'F_OK', local: 'F_OK' },
				{ imported: 'R_OK', local: 'R_OK' },
			],
		});

		assert.equal(result.edits.length, 1);
		assert.deepEqual(result.mappings, [
			{ local: 'F_OK', replacement: 'constants.F_OK' },
			{ local: 'R_OK', replacement: 'constants.R_OK' },
		]);
		assert.equal(
			root.root().commitEdits(result.edits),
			"import { readFile, constants } from 'node:fs';",
		);
	});

	it('applies namespace replacements for matched access constants', () => {
		const source = [
			"import fs from 'node:fs';",
			'fs.accessSync(path, fs.F_OK);',
			'fs.accessSync(path, fs.R_OK);',
		].join('\n');
		const root = parseRoot(source);
		const edits: Edit[] = [];

		applyNamespaceReplacements(
			root.root(),
			edits,
			new Map([
				['fs.F_OK', 'fs.constants.F_OK'],
				['fs.R_OK', 'fs.constants.R_OK'],
			]),
		);

		assert.equal(
			root.root().commitEdits(edits),
			[
				"import fs from 'node:fs';",
				'fs.accessSync(path, fs.constants.F_OK);',
				'fs.accessSync(path, fs.constants.R_OK);',
			].join('\n'),
		);
	});

	it('applies local replacements to identifier usage', () => {
		const source = [
			"import { F_OK } from 'node:fs';",
			'const mode = F_OK;',
		].join('\n');
		const root = parseRoot(source);
		const edits: Edit[] = [];

		applyLocalReplacements(
			root.root(),
			edits,
			new Map([['F_OK', 'constants.F_OK']]),
		);

		assert.equal(
			root.root().commitEdits(edits),
			["import { F_OK } from 'node:fs';", 'const mode = constants.F_OK;'].join(
				'\n',
			),
		);
	});

	it('does not replace imported identifier declarations', () => {
		const source = "import { F_OK } from 'node:fs';";
		const root = parseRoot(source);
		const edits: Edit[] = [];

		applyLocalReplacements(
			root.root(),
			edits,
			new Map([['F_OK', 'constants.F_OK']]),
		);

		assert.equal(root.root().commitEdits(edits), source);
	});

	it('rewrites bindings when all imports are access mode constants', () => {
		const source = "import { F_OK, R_OK, W_OK } from 'node:fs';";
		const root = parseRoot(source);
		const statement = root.root().find({
			rule: { kind: 'import_statement' },
		});
		const pattern = root.root().find({
			rule: { kind: 'named_imports' },
		});

		assert.ok(statement);
		assert.ok(pattern);

		const result = rewriteCollectedBindings({
			statement,
			pattern,
			promisesBinding: '',
			kept: [],
			removed: [
				{ imported: 'F_OK', local: 'F_OK' },
				{ imported: 'R_OK', local: 'R_OK' },
				{ imported: 'W_OK', local: 'W_OK' },
			],
		});

		assert.equal(result.edits.length, 1);
		assert.equal(result.mappings.length, 3);
		assert.equal(
			root.root().commitEdits(result.edits),
			"import { constants } from 'node:fs';",
		);
	});

	it('does not add constants when already imported', () => {
		const source = "import { F_OK, constants, readFile } from 'node:fs';";
		const root = parseRoot(source);
		const statement = root.root().find({
			rule: { kind: 'import_statement' },
		});
		const pattern = root.root().find({
			rule: { kind: 'named_imports' },
		});

		assert.ok(statement);
		assert.ok(pattern);

		const result = rewriteCollectedBindings({
			statement,
			pattern,
			promisesBinding: '',
			kept: ['constants', 'readFile'],
			removed: [{ imported: 'F_OK', local: 'F_OK' }],
		});

		assert.equal(
			root.root().commitEdits(result.edits),
			"import { constants, readFile } from 'node:fs';",
		);
	});

	it('replaces multiple occurrences of same identifier', () => {
		const source = [
			"import { F_OK } from 'node:fs';",
			'if (mode === F_OK) { access(F_OK); }',
		].join('\n');
		const root = parseRoot(source);
		const edits: Edit[] = [];

		applyLocalReplacements(
			root.root(),
			edits,
			new Map([['F_OK', 'constants.F_OK']]),
		);

		const result = root.root().commitEdits(edits);
		const count = (result.match(/constants\.F_OK/g) || []).length;
		assert.equal(count, 2);
	});

	it('applies namespace replacements with deep paths', () => {
		const source = [
			'const fsPromises = fs.promises;',
			'fsPromises.access(path, fs.promises.F_OK);',
		].join('\n');
		const root = parseRoot(source);
		const edits: Edit[] = [];

		applyNamespaceReplacements(
			root.root(),
			edits,
			new Map([['fs.promises.F_OK', 'fs.promises.constants.F_OK']]),
		);

		assert.equal(
			root.root().commitEdits(edits),
			[
				'const fsPromises = fs.promises;',
				'fsPromises.access(path, fs.promises.constants.F_OK);',
			].join('\n'),
		);
	});

	it('replaces identifier in complex expressions', () => {
		const source = [
			"import { R_OK } from 'node:fs';",
			'const modes = R_OK | fs.W_OK;',
			'check(R_OK, file);',
		].join('\n');
		const root = parseRoot(source);
		const edits: Edit[] = [];

		applyLocalReplacements(
			root.root(),
			edits,
			new Map([['R_OK', 'constants.R_OK']]),
		);

		assert.equal(
			root.root().commitEdits(edits),
			[
				"import { R_OK } from 'node:fs';",
				'const modes = constants.R_OK | fs.W_OK;',
				'check(constants.R_OK, file);',
			].join('\n'),
		);
	});

	it('escapes single character special regex chars', () => {
		assert.equal(escapeRegExp('.'), '\\.');
		assert.equal(escapeRegExp('*'), '\\*');
		assert.equal(escapeRegExp('+'), '\\+');
		assert.equal(escapeRegExp('?'), '\\?');
		assert.equal(escapeRegExp('$'), '\\$');
		assert.equal(escapeRegExp('^'), '\\^');
		assert.equal(escapeRegExp('|'), '\\|');
		assert.equal(escapeRegExp('\\'), '\\\\');
	});

	it('handles empty namespace replacements map', () => {
		const source = "import fs from 'node:fs'; fs.F_OK;";
		const root = parseRoot(source);
		const edits: Edit[] = [];

		applyNamespaceReplacements(root.root(), edits, new Map());

		assert.equal(root.root().commitEdits(edits), source);
		assert.equal(edits.length, 0);
	});

	it('handles empty local replacements map', () => {
		const source = "import { F_OK } from 'node:fs'; const m = F_OK;";
		const root = parseRoot(source);
		const edits: Edit[] = [];

		applyLocalReplacements(root.root(), edits, new Map());

		assert.equal(root.root().commitEdits(edits), source);
		assert.equal(edits.length, 0);
	});

	it('rewriteNamedImports processes all four access mode constants', () => {
		const source =
			"import { F_OK, R_OK, W_OK, X_OK, readFile } from 'node:fs';";
		const root = parseRoot(source);
		const statement = root.root().find({
			rule: { kind: 'import_statement' },
		});
		const pattern = root.root().find({
			rule: { kind: 'named_imports' },
		});

		assert.ok(statement);
		assert.ok(pattern);

		const result = rewriteNamedImports(statement, pattern, '');

		assert.equal(result.edits.length, 1);
		assert.equal(result.mappings.length, 4);
		assert.deepEqual(
			result.mappings.map((m) => m.local),
			['F_OK', 'R_OK', 'W_OK', 'X_OK'],
		);
	});

	it('rewriteCollectedBindings uses promises binding in mappings', () => {
		const source = "import { F_OK } from 'node:fs';";
		const root = parseRoot(source);
		const statement = root.root().find({
			rule: { kind: 'import_statement' },
		});
		const pattern = root.root().find({
			rule: { kind: 'named_imports' },
		});

		assert.ok(statement);
		assert.ok(pattern);

		const result = rewriteCollectedBindings({
			statement,
			pattern,
			promisesBinding: 'fsPromises',
			kept: [],
			removed: [{ imported: 'F_OK', local: 'F_OK' }],
		});

		assert.deepEqual(result.mappings, [
			{ local: 'F_OK', replacement: 'fsPromises.constants.F_OK' },
		]);
	});
});
