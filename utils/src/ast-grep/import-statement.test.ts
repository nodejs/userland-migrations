import assert from "node:assert/strict";
import { describe, it } from "node:test";
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import {
	getNodeImportStatements,
	getDefaultImportIdentifier
} from "./import-statement.ts";

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

    it("should handle getDefaultImportIdentifier", () => {
        const code = dedent`
            import fs from 'fs';
            import { join } from 'node:path';
            import defaultExport from "module-a";
            import * as namespace from "module-b";
        `;
        const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

        const fsImports = getNodeImportStatements(ast, 'fs');
        const fsDefault = getDefaultImportIdentifier(fsImports[0]);
        assert.strictEqual(fsDefault?.text(), 'fs');

        const pathImports = getNodeImportStatements(ast, 'path');
        const pathDefault = getDefaultImportIdentifier(pathImports[0]);
        assert.strictEqual(pathDefault, null);

        const moduleAImports = getNodeImportStatements(ast, 'module-a');
        const moduleADefault = getDefaultImportIdentifier(moduleAImports[0]);
        assert.strictEqual(moduleADefault?.text(), 'defaultExport');

        const moduleBImports = getNodeImportStatements(ast, 'module-b');
        const moduleBDefault = getDefaultImportIdentifier(moduleBImports[0]);
        assert.strictEqual(moduleBDefault, null);
    });

    it("should handle edge cases for import statements", () => {
        const code = dedent`
            import "side-effect-only";
            import {} from "empty-imports";
            import fs from 'fs';
        `;
        const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

        // Test modules that don't exist
        const nonExistentImports = getNodeImportStatements(ast, 'non-existent');
        assert.strictEqual(nonExistentImports.length, 0);

        // Test side-effect only imports
        const sideEffectImports = getNodeImportStatements(ast, 'side-effect-only');
        assert.strictEqual(sideEffectImports.length, 1);
        assert.strictEqual(getDefaultImportIdentifier(sideEffectImports[0]), null);

        // Test empty imports
        const emptyImports = getNodeImportStatements(ast, 'empty-imports');
        assert.strictEqual(emptyImports.length, 1);
        assert.strictEqual(getDefaultImportIdentifier(emptyImports[0]), null);
    });
})
