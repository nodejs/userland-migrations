import assert from "node:assert/strict";
import { describe, it } from "node:test";
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import { getNodeImportStatements, getNodeImportCalls } from "./import-statement.ts";

describe("import-statement", () => {
	it("should return import statements", () => {
		const code = dedent`
			import fs from 'fs';
			import { join } from 'node:path';
			import { spawn } from "child_process";
			import { styleText } from "node:util";
			import defaultExport from "module-a";
			import * as namespace from "module-b";
			import { named1, named2 as alias } from "module-c";
			import "module-d";
			import "";
			import config from "./config.json" assert { type: "json" };
			import {} from "module-e";
		`;
		const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

		const fsImports = getNodeImportStatements(ast, 'fs');
		assert.strictEqual(fsImports.length, 1);
		assert.strictEqual(fsImports[0].field('source')?.text(), "'fs'");

		const pathImports = getNodeImportStatements(ast, 'path');
		assert.strictEqual(pathImports.length, 1);
		assert.strictEqual(pathImports[0].field('source')?.text(), "'node:path'");

		const childProcessImports = getNodeImportStatements(ast, 'child_process');
		assert.strictEqual(childProcessImports.length, 1);
		assert.strictEqual(childProcessImports[0].field('source')?.text(), '"child_process"');

		const utilImports = getNodeImportStatements(ast, 'util');
		assert.strictEqual(utilImports.length, 1);
		assert.strictEqual(utilImports[0].field('source')?.text(), '"node:util"');
	});

	it("should return import calls", () => {
		const code = dedent`
			const fs = await import('fs');
			var { join } = await import('node:path');
			let { spawn } = await import("child_process");
			const { styleText } = await import("node:util");
			const pending = import("node:module");
			await import("no:assignment");
			await import(variable);
			await import(\`backticks\`);
			import("no:assignment");
			import(variable);
			import(\`backticks\`);
		`;
		const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

		const fsCalls = getNodeImportCalls(ast, 'fs');
		assert.strictEqual(fsCalls.length, 1);
		// For dynamic imports, the module name is in the first argument, not a source field
		const fsArgs = fsCalls[0].field('arguments');
		const fsString = fsArgs?.find({ rule: { kind: "string" } });
		assert.strictEqual(fsString?.text(), "'fs'");

		const pathCalls = getNodeImportCalls(ast, 'path');
		assert.strictEqual(pathCalls.length, 1);
		const pathArgs = pathCalls[0].field('arguments');
		const pathString = pathArgs?.find({ rule: { kind: "string" } });
		assert.strictEqual(pathString?.text(), "'node:path'");

		const childProcessCalls = getNodeImportCalls(ast, 'child_process');
		assert.strictEqual(childProcessCalls.length, 1);
		const childProcessArgs = childProcessCalls[0].field('arguments');
		const childProcessString = childProcessArgs?.find({ rule: { kind: "string" } });
		assert.strictEqual(childProcessString?.text(), '"child_process"');

		const utilCalls = getNodeImportCalls(ast, 'util');
		assert.strictEqual(utilCalls.length, 1);
		const utilArgs = utilCalls[0].field('arguments');
		const utilString = utilArgs?.find({ rule: { kind: "string" } });
		assert.strictEqual(utilString?.text(), '"node:util"');

		// do we need to catch pending promises?
		const moduleCalls = getNodeImportCalls(ast, 'module');
		assert.strictEqual(moduleCalls.length, 1);
		const moduleArgs = moduleCalls[0].field('arguments');
		const moduleString = moduleArgs?.find({ rule: { kind: "string" } });
		assert.strictEqual(moduleString?.text(), '"node:module"');
	});
});
