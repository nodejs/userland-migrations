import { equal, match } from 'node:assert/strict';
import { execPath } from 'node:process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { spawnPromisified } from '../../utils/src/spawn-promisified.ts';

import { SUPPORTED_PREFIXES } from './pr-prefixes.ts';

describe('Pull Request checks', { concurrency: true }, async () => {
	const encoding = 'utf8';
	const prTestPath = fileURLToPath(import.meta.resolve('./pr-title.ts'));

	for (const prefix of SUPPORTED_PREFIXES) {
		describe(prefix, () => {
			it(`should pass when valid`, async () => {
				const { code, stderr } = await spawnPromisified(
					execPath,
					[prTestPath],
					{
						encoding,
						env: { PR_TITLE: `${prefix}(DEP0000): update …` },
					},
				);

				equal(stderr, '');
				equal(code, 0);
			});

			it(`should fail when missing scope`, async () => {
				const { code, stderr } = await spawnPromisified(
					execPath,
					[prTestPath],
					{
						encoding,
						env: { PR_TITLE: `${prefix}: update …` },
					},
				);

				match(stderr, /AssertionError/);
				match(stderr, new RegExp(prefix));
				match(stderr, /pull request title/i);
				equal(code, 1);
			});

			it(`should fail scope is misformatted`, async () => {
				const { code, stderr } = await spawnPromisified(
					execPath,
					[prTestPath],
					{
						encoding,
						env: { PR_TITLE: `${prefix}(DEP0000) update …` },
					},
				);

				match(stderr, /AssertionError/);
				match(stderr, new RegExp(prefix));
				match(stderr, /pull request title/i);
				equal(code, 1);
			});
		});
	}

	describe('unsupported prefix', () => {
		it('should fail', async () => {
			const prefix = 'foo';
			const { code, stderr } = await spawnPromisified(execPath, [prTestPath], {
				encoding,
				env: { PR_TITLE: `${prefix}(DEP0000): update …` },
			});

			match(stderr, /AssertionError/);
			match(stderr, new RegExp(prefix));
			match(stderr, /pull request title/i);
			for (const p of SUPPORTED_PREFIXES) match(stderr, new RegExp(p));
			equal(code, 1);
		});
	})
});
