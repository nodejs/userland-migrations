import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnPromisified } from '@nodejs/codemod-utils/spawn-promisified';

describe('workflow', () => {
	it('should update bad specifiers and ignore good ones', async (t) => {
		const e2eFixtPath = fileURLToPath(import.meta.resolve('./fixtures/e2e/'));

		await spawnPromisified(
			'npx',
			[
				'codemod',
				'workflow',
				'run',
				'-w',
				'../../../workflow.yaml',
				'-t',
				'.',
				'--allow-fs',
				'--allow-dirty',
				'--no-interactive',
			],
			{
				cwd: e2eFixtPath,
				stdio: 'inherit',
				env: {
					...process.env,
					NODE_OPTIONS: [
						process.env.NODE_OPTIONS,
						'--experimental-import-meta-resolve',
					]
						.filter(Boolean)
						.join(' '),
				},
			},
		);

		const result = await readFile(resolve(e2eFixtPath, 'test.ts'), {
			encoding: 'utf-8',
		});

		t.assert.snapshot(result);

		// restore the original file for the next test run using git
		const git = await spawnPromisified('git', ['checkout', '--', 'test.ts'], {
			cwd: e2eFixtPath,
			stdio: 'inherit',
		});

		t.assert.equal(git.code, 0, 'git command should exit with code 0');
	});
});
