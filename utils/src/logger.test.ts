import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execPath, platform } from 'node:process';
import { spawnPromisified } from './spawn-promisified.ts';

const skipWindows = platform === 'win32';

describe('Logger', { skip: skipWindows, concurrency: true }, () => {
  it('should log info messages', async (t) => {
		const { code, stdout } = await spawnPromisified(
			execPath,
			[
				'-e',
				`
				import { info } from './logger.ts';
				info('This is an info message');
			`,
			],
			{
				cwd: import.meta.dirname,
			},
		);

		assert.strictEqual(code, 0);
		t.assert.snapshot(stdout);
	});

	  it('should log warning messages', async (t) => {
		const { code, stdout, stderr } = await spawnPromisified(
			execPath,
			[
				'-e',
				`
				import { warn } from './logger.ts';
				warn('This is a warning message');
			`,
			],
			{
				cwd: import.meta.dirname,
			},
		);

		assert.strictEqual(code, 0);
		assert.strictEqual(stdout, '');
		t.assert.snapshot(stderr);
	});

	it('should log error messages', async (t) => {
		const { code, stdout, stderr } = await spawnPromisified(
			execPath,
			[
				'-e',
				`
				import { error } from './logger.ts';
				error('This is an error message');
			`,
			],
			{
				cwd: import.meta.dirname,
			},
		);

		assert.strictEqual(code, 0);
		assert.strictEqual(stdout, '');
		t.assert.snapshot(stderr);
	});

	it('should log debug messages', async (t) => {
		const { code, stdout } = await spawnPromisified(
			execPath,
			[
				'-e',
				`
				import { debug } from './logger.ts';
				debug('This is a debug message');
			`,
			],
			{
				cwd: import.meta.dirname,
				env: {
					DEBUG: 'true'
				}
			},
		);

		assert.strictEqual(code, 0);
		t.assert.snapshot(stdout);
	});

	it('should not log debug messages when DEBUG is not set', async () => {
		const { code, stdout } = await spawnPromisified(
			execPath,
			[
				'-e',
				`
				import { debug } from './logger.ts';
				debug('This debug message should not appear');
			`,
			],
			{
				cwd: import.meta.dirname,
			},
		);

		assert.strictEqual(code, 0);
		assert.strictEqual(stdout, '');
	});
});
