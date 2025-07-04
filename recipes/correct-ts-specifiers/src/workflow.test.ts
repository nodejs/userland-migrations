import { resolve } from 'node:path';
import { execPath } from 'node:process';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnPromisified } from '@nodejs/codemod-utils/spawn-promisified';

describe('workflow', () => {
	it('should update bad specifiers and ignore good ones', async (t) => {
		const e2eFixtPath = fileURLToPath(import.meta.resolve('./fixtures/e2e/'));

		await spawnPromisified(
			execPath,
			[
				'--no-warnings',
				'--experimental-strip-types',
				'--experimental-import-meta-resolve',
				'../../workflow.ts',
			],
			{
				cwd: e2eFixtPath,
				stdio: 'inherit',
			},
		);

		const result = await readFile(resolve(e2eFixtPath, 'test.ts'), { encoding: 'utf-8' });

		t.assert.snapshot(result);
	});
});
