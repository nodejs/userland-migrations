import assert from "node:assert/strict";
import { describe, it } from "node:test";
import astGrep from "@ast-grep/napi";
import dedent from "dedent";
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

		const fsImports = getNodeImportStatements(ast, "fs");
		assert.strictEqual(fsImports.length, 1);
		assert.strictEqual(fsImports[0].field("source")?.text(), "'fs'");

		const pathImports = getNodeImportStatements(ast, "path");
		assert.strictEqual(pathImports.length, 1);
		assert.strictEqual(pathImports[0].field("source")?.text(), "'node:path'");

		const childProcessImports = getNodeImportStatements(ast, "child_process");
		assert.strictEqual(childProcessImports.length, 1);
		assert.strictEqual(childProcessImports[0].field("source")?.text(), '"child_process"');

		const utilImports = getNodeImportStatements(ast, "util");
		assert.strictEqual(utilImports.length, 1);
		assert.strictEqual(utilImports[0].field("source")?.text(), '"node:util"');
	});

	it("should return import calls", () => {
		const code = dedent`
			const fs = await import('fs');
			var { join } = await import('node:path');
			let { spawn } = await import("child_process");
			const { styleText } = await import("node:util");
			await import("no:assignment");
			await import(variable);
			await import(\`backticks\`);
			import("no:assignment");
			import(variable);
			import(\`backticks\`);
		`;
		const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

		const fsCalls = getNodeImportCalls(ast, "fs");
		assert.strictEqual(fsCalls.length, 1);
		const fsCallExpr = fsCalls[0].field("value")?.children()[1]; // await_expression -> call_expression
		assert.strictEqual(fsCallExpr?.field("function")?.text(), "import");
		assert.strictEqual(
			fsCallExpr
				?.field("arguments")
				?.find({ rule: { kind: "string" } })
				?.text(),
			"'fs'",
		);

		const pathCalls = getNodeImportCalls(ast, "path");
		assert.strictEqual(pathCalls.length, 1);
		const pathCallExpr = pathCalls[0].field("value")?.children()[1]; // await_expression -> call_expression
		assert.strictEqual(pathCallExpr?.field("function")?.text(), "import");
		assert.strictEqual(
			pathCallExpr
				?.field("arguments")
				?.find({ rule: { kind: "string" } })
				?.text(),
			"'node:path'",
		);

		const childProcessCalls = getNodeImportCalls(ast, "child_process");
		assert.strictEqual(childProcessCalls.length, 1);
		const childProcessCallExpr = childProcessCalls[0].field("value")?.children()[1]; // await_expression -> call_expression
		assert.strictEqual(childProcessCallExpr?.field("function")?.text(), "import");
		assert.strictEqual(
			childProcessCallExpr
				?.field("arguments")
				?.find({ rule: { kind: "string" } })
				?.text(),
			'"child_process"',
		);

		const utilCalls = getNodeImportCalls(ast, "util");
		assert.strictEqual(utilCalls.length, 1);
		const utilCallExpr = utilCalls[0].field("value")?.children()[1]; // await_expression -> call_expression
		assert.strictEqual(utilCallExpr?.field("function")?.text(), "import");
		assert.strictEqual(
			utilCallExpr
				?.field("arguments")
				?.find({ rule: { kind: "string" } })
				?.text(),
			'"node:util"',
		);
	});

	it("shouldn't catch pending promises during import calls", () => {
		const code = dedent`
			const pending = import("node:module");
		`;
		const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

		const moduleCalls = getNodeImportCalls(ast, "module");
		assert.strictEqual(moduleCalls.length, 0, "Pending import calls should not be caught");
	});

	it("should catch thenable during import calls", () => {
		const code = dedent`
			import("node:fs").then((mdl) => {
				const readFile = mdl.readFile;

				readFile("package.json", "utf8", (err, data) => {
					if (err) throw err;
					console.log({ data });
				});
			});
		`;
		const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

		const moduleCalls = getNodeImportCalls(ast, "fs");
		assert.strictEqual(moduleCalls.length, 1, "thenable import calls should be caught");
	});

	it("should catch thenable during import calls with catch block", () => {
		const code = dedent`
			import("node:fs").then((mdl) => {
				const readFile = mdl.readFile;

				readFile("package.json", "utf8", (err, data) => {
					if (err) throw err;
					console.log({ data });
				});
			}).catch(console.log);
		`;
		const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

		const moduleCalls = getNodeImportCalls(ast, "fs");
		assert.strictEqual(moduleCalls.length, 1, "thenable import calls should be caught");
	});
});
