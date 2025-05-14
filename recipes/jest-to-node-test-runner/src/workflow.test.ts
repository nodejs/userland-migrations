import { resolve } from "node:path";
import { execPath } from "node:process";
import { readFile } from "node:fs/promises";
import { describe, it, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

import { spawnPromisified } from "../test/spawn-promisified.ts";
import { workflow } from "./workflow.ts";

describe("workflow", () => {
	it("should update bad specifiers and ignore good ones", async (t: TestContext) => {
		const e2eFixtPath = fileURLToPath(import.meta.resolve("./fixtures/e2e/"));
		const source = await readFile(resolve(e2eFixtPath, "test.ts"), { encoding: "utf-8" });
		const result = await workflow(source);
		const importStatement =
			'import { describe, it } from "node:test";\nimport { expect } from "expect";\n';

		t.assert.deepStrictEqual(result, `${importStatement}${source.split("\n").slice(1).join("\n")}`);
	});
});
