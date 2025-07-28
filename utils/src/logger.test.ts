import assert from 'node:assert/strict';
import { execPath } from 'node:process';
import { describe, it } from 'node:test';
import dedent from 'dedent';
import { spawnPromisified } from './spawn-promisified.ts';

describe('logger', { concurrency: true }, () => {
	it('should emit non-error entries to standard out, collated by source module', async (t) => {
		const { code, stdout } = await spawnPromisified(
			execPath,
			[
				'--no-warnings',
				'--experimental-strip-types',
				'-e',
				dedent`
				import { logger, setCodemodName } from './logger.ts';

				setCodemodName('test-codemod');

				const source1 = '/tmp/foo.js';
				logger(source1, 'log', 'maybe don’t');
				logger(source1, 'log', 'maybe not that either');

				const source2 = '/tmp/foo.js';
				logger(source2, 'log', 'still maybe don’t');
				logger(source2, 'log', 'more maybe not');
			`,
			],
			{
				cwd: import.meta.dirname,
			},
		);

		t.assert.snapshot(stdout);
		assert.equal(code, 0);
	});

	it('should emit error entries to standard error, collated by source module', async (t) => {
		const { code, stderr } = await spawnPromisified(
			execPath,
			[
				'--no-warnings',
				'--experimental-strip-types',
				'-e',
				dedent`
				import { logger, setCodemodName } from './logger.ts';

				setCodemodName('test-codemod');

				const source1 = '/tmp/foo.js';
				logger(source1, 'error', 'sh*t happened');
				logger(source1, 'warn', 'maybe bad');

				const source2 = '/tmp/foo.js';
				logger(source2, 'error', 'sh*t happened');
				logger(source2, 'warn', 'maybe other bad');
				`,
			],
			{
				cwd: import.meta.dirname,
			},
		);

		t.assert.snapshot(stderr);
		assert.equal(code, 1);
	});

	it('should work without a codemod name', async (t) => {
		const { code, stdout } = await spawnPromisified(
			execPath,
			[
				'--no-warnings',
				'--experimental-strip-types',
				'-e',
				dedent`
				import { logger } from './logger.ts';

				const source1 = '/tmp/foo.js';
				logger(source1, 'log', 'maybe don’t');
				logger(source1, 'log', 'maybe not that either');

				const source2 = '/tmp/foo.js';
				logger(source2, 'log', 'still maybe don’t');
				logger(source2, 'log', 'more maybe not');
			`,
			],
			{
				cwd: import.meta.dirname,
			},
		);

		t.assert.snapshot(stdout);
		assert.equal(code, 0);
	});

	it('should handle multiple codemods with different names correctly', async () => {
		const { code, stdout } = await spawnPromisified(
			execPath,
			[
				'--no-warnings',
				'--experimental-strip-types',
				'-e',
				dedent`
				import { logger, setCodemodName } from './logger.ts';

				// Simulate first codemod
				setCodemodName('codemod-a');
				logger('/tmp/file1.js', 'log', 'Message from codemod A');

				// Simulate second codemod (this would previously overwrite the name)
				logger('/tmp/file2.js', 'log', 'Message from codemod B', 'codemod-b');

				// Another message from first codemod (should still show as codemod-a)
				logger('/tmp/file3.js', 'log', 'Another message from codemod A');
			`,
			],
			{
				cwd: import.meta.dirname,
			},
		);

		// Should show both codemod names in output
		assert(stdout.includes('[Codemod: codemod-a]'));
		assert(stdout.includes('[Codemod: codemod-b]'));
		assert(stdout.includes('Message from codemod A'));
		assert(stdout.includes('Message from codemod B'));
		assert.equal(code, 0);
	});
});
