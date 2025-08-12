import assert from "node:assert/strict";
import { describe, it } from "node:test";
import astGrep from '@ast-grep/napi';
import dedent from 'dedent';
import {
	getNodeRequireCalls,
	getRequireNamespaceIdentifier
} from "./require-call.ts";

describe("require-call", () => {
	const code = dedent`
		const fs = require('fs');
		var { join } = require('node:path');
		let { spawn } = require("child_process");
		const { styleText } = require("node:util");
		require("no:assignment");
		require(variable);
		require(\`backticks\`);
	`;
	const ast = astGrep.parse(astGrep.Lang.JavaScript, code);


	it("should return require calls", () => {
		const fsRequires = getNodeRequireCalls(ast, 'fs');
		assert.strictEqual(fsRequires.length, 1);
		assert.strictEqual(fsRequires[0].field('value')?.text(), "require('fs')");

		const pathRequires = getNodeRequireCalls(ast, 'path');
		assert.strictEqual(pathRequires.length, 1);
		assert.strictEqual(pathRequires[0].field('value')?.text(), "require('node:path')");

		const childProcessRequires = getNodeRequireCalls(ast, 'child_process');
		assert.strictEqual(childProcessRequires.length, 1);
		assert.strictEqual(childProcessRequires[0].field('value')?.text(), 'require("child_process")');

		const utilRequires = getNodeRequireCalls(ast, 'util');
		assert.strictEqual(utilRequires.length, 1);
		assert.strictEqual(utilRequires[0].field('value')?.text(), 'require("node:util")');
	});

	it("should return require calls", () => {
        const fsRequires = getNodeRequireCalls(ast, 'fs');
        assert.strictEqual(fsRequires.length, 1);
        assert.strictEqual(fsRequires[0].field('value')?.text(), "require('fs')");

        const pathRequires = getNodeRequireCalls(ast, 'path');
        assert.strictEqual(pathRequires.length, 1);
        assert.strictEqual(pathRequires[0].field('value')?.text(), "require('node:path')");

        const childProcessRequires = getNodeRequireCalls(ast, 'child_process');
        assert.strictEqual(childProcessRequires.length, 1);
        assert.strictEqual(childProcessRequires[0].field('value')?.text(), 'require("child_process")');

        const utilRequires = getNodeRequireCalls(ast, 'util');
        assert.strictEqual(utilRequires.length, 1);
        assert.strictEqual(utilRequires[0].field('value')?.text(), 'require("node:util")');
    });

    it("should handle getRequireNamespaceIdentifier", () => {
        const code = dedent`
            const fs = require('fs');
            const { join } = require('node:path');
            const util = require('node:util');
        `;
        const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

        const fsRequires = getNodeRequireCalls(ast, 'fs');
        const fsNamespace = getRequireNamespaceIdentifier(fsRequires[0]);
        assert.strictEqual(fsNamespace?.text(), 'fs');

        const pathRequires = getNodeRequireCalls(ast, 'path');
        const pathNamespace = getRequireNamespaceIdentifier(pathRequires[0]);
        assert.strictEqual(pathNamespace, null);

        const utilRequires = getNodeRequireCalls(ast, 'util');
        const utilNamespace = getRequireNamespaceIdentifier(utilRequires[0]);
        assert.strictEqual(utilNamespace?.text(), 'util');
    });

    it("shouldn't catch standalone require calls", () => {
        const code = dedent`
            require("side-effect-only");
            const fs = require('fs');
        `;
        const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

        // Standalone require calls should not be caught
        const sideEffectRequires = getNodeRequireCalls(ast, 'side-effect-only');
        assert.strictEqual(sideEffectRequires.length, 0, "Standalone require calls should not be caught");

        // But assigned require calls should be caught
        const fsRequires = getNodeRequireCalls(ast, 'fs');
        assert.strictEqual(fsRequires.length, 1);
    });

    it("should handle edge cases for require calls", () => {
        const code = dedent`
            const fs = require('fs');
            const empty = require();
            const dynamic = require(variable);
        `;
        const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

        // Test modules that don't exist
        const nonExistentRequires = getNodeRequireCalls(ast, 'non-existent');
        assert.strictEqual(nonExistentRequires.length, 0);

        // Test dynamic requires (with variables) should not be caught
        const variableRequires = getNodeRequireCalls(ast, 'variable');
        assert.strictEqual(variableRequires.length, 0);
    });

    it("should handle different variable declaration types", () => {
        const code = dedent`
            const fs1 = require('fs');
            var fs2 = require('fs');
            let fs3 = require('fs');
        `;
        const ast = astGrep.parse(astGrep.Lang.JavaScript, code);

        const fsRequires = getNodeRequireCalls(ast, 'fs');
        assert.strictEqual(fsRequires.length, 3);
        assert.strictEqual(getRequireNamespaceIdentifier(fsRequires[0])?.text(), 'fs1');
        assert.strictEqual(getRequireNamespaceIdentifier(fsRequires[1])?.text(), 'fs2');
        assert.strictEqual(getRequireNamespaceIdentifier(fsRequires[2])?.text(), 'fs3');
    });
});
