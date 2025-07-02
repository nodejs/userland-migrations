import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { spawnPromisified } from '@nodejs/codemod-utils/spawn-promisified';

const cwd = new URL('../', import.meta.url);
const fixturesDir = new URL('tests/fixtures', cwd);
const expectedDir = new URL('tests/expected', cwd);

test("workflow - import-assertions-to-attributes", async (t) => {
	await spawnPromisified(
		'npx',
		[
			'codemod@next',
			'jssg',
			'run',
			'src/workflow.ts',
			'.',
		],
		{
			cwd,
			stdio: 'inherit',
		},
	);

	const files = fs.readdirSync(fixturesDir.pathname, { withFileTypes: true })
		.filter(dirent => dirent.isFile())
		.map(dirent => dirent.name);

	for (const file of files) {
		const filePath = path.join(fixturesDir.pathname, file);
		const expectedPath = path.join(expectedDir.pathname, file);
		const content = fs.readFileSync(filePath, 'utf8');
		const expectedContent = fs.readFileSync(expectedPath, 'utf8');

		assert.strictEqual(content, expectedContent, `Content of ${file} does not match expected content.`);
		t.assert.snapshot(content);
	}
});
