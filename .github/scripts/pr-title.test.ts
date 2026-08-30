import { equal, match } from 'node:assert/strict';
import { execPath } from 'node:process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { spawnPromisified } from '../../utils/src/spawn-promisified.ts';

import { SUPPORTED_PREFIXES } from './pr-prefixes.ts';

describe('Pull Request checks', { concurrency: true }, async () => {
	const encoding = 'utf8';
	const prTestPath = fileURLToPath(import.meta.resolve('./pr-title.ts'));

	const runCheck = async (title: string) =>
		spawnPromisified(execPath, [prTestPath], {
			encoding,
			env: { PR_TITLE: title },
		});

	const assertPass = async (title: string) => {
		const { code, stderr } = await runCheck(title);

		equal(stderr, '');
		equal(code, 0);
	};

	const assertFail = async (title: string) => {
		const { code, stderr } = await runCheck(title);

		match(stderr, /AssertionError/);
		match(stderr, /pull request title/i);
		equal(code, 1);
	};

	describe('supported prefixes', () => {
		for (const prefix of SUPPORTED_PREFIXES) {
			describe(prefix, () => {
				it('passes with valid scope', async () => {
					await assertPass(
						`${prefix}(DEP0000): update dependency`,
					);
				});

				it('passes with normal scope', async () => {
					await assertPass(
						`${prefix}(api): update endpoint`,
					);
				});

				it('passes with numeric scope', async () => {
					await assertPass(
						`${prefix}(v2): update API`,
					);
				});

				it('fails without scope', async () => {
					await assertFail(
						`${prefix}: update dependency`,
					);
				});

				it('fails without colon', async () => {
					await assertFail(
						`${prefix}(api) update dependency`,
					);
				});

				it('fails without space after colon', async () => {
					await assertFail(
						`${prefix}(api):update dependency`,
					);
				});

				it('fails with empty scope', async () => {
					await assertFail(
						`${prefix}(): update dependency`,
					);
				});
			});
		}
	});

	describe('scope formats', () => {
		it('allows package.json scopes', async () => {
			await assertPass(
				'setup(package.json): reduce amount of code to maintain',
			);
		});

		it('allows dotted scopes', async () => {
			await assertPass(
				'fix(node.test.ts): update tests',
			);
		});

		it('allows kebab-case scopes', async () => {
			await assertPass(
				'feat(my-feature): add feature',
			);
		});

		it('allows snake_case scopes', async () => {
			await assertPass(
				'fix(my_module): update module',
			);
		});

		it('allows backticks in scopes', async () => {
			await assertPass(
				'feat(`foo`): introduced',
			);
		});

		it('allows npm package scopes', async () => {
			await assertPass(
				'dep(@scope/pkg): update package',
			);
		});

		it('allows slash-separated scopes', async () => {
			await assertPass(
				'fix(api/users): fix endpoint',
			);
		});

		it('allows long scopes', async () => {
			await assertPass(
				'feat(very-long-package-name-that-is-used-by-the-app): cleanup',
			);
		});
	});

	describe('invalid scope formats', () => {
		it('fails with missing opening parenthesis', async () => {
			await assertFail(
				'featapi): add feature',
			);
		});

		it('fails with missing closing parenthesis', async () => {
			await assertFail(
				'feat(api: add feature',
			);
		});

		it('fails with extra closing parenthesis', async () => {
			await assertFail(
				'feat(api)): add feature',
			);
		});

		it('fails with whitespace-only scope', async () => {
			await assertFail(
				'feat( ): add feature',
			);
		});

		it('fails with newline in title', async () => {
			await assertFail(
				'feat(api): add feature\nsecond line',
			);
		});
	});

	describe('description formats', () => {
		it('allows empty description', async () => {
			await assertPass(
				'feat(api): ',
			);
		});

		it('allows punctuation', async () => {
			await assertPass(
				'feat(api): update API, remove old behavior.',
			);
		});

		it('allows unicode', async () => {
			await assertPass(
				'feat(api): improve documentation 🚀',
			);
		});

		it('allows numbers', async () => {
			await assertPass(
				'fix(api): fix issue #1234',
			);
		});
	});

	describe('prefix validation', () => {
		it('fails for unsupported prefix', async () => {
			const { code, stderr } = await runCheck(
				'foo(api): update dependency',
			);

			match(stderr, /AssertionError/);
			match(stderr, /foo/);

			for (const prefix of SUPPORTED_PREFIXES) {
				match(stderr, new RegExp(prefix));
			}

			equal(code, 1);
		});

		it('fails with uppercase prefix', async () => {
			await assertFail(
				'Feat(api): update feature',
			);
		});

		it('fails with leading whitespace', async () => {
			await assertFail(
				' feat(api): update feature',
			);
		});

		it('fails with whitespace before scope', async () => {
			await assertFail(
				'feat (api): update feature',
			);
		});
	});

	describe('real world examples', () => {
		it('accepts setup(package.json)', async () => {
			await assertPass(
				'setup(package.json): reduce amount of code to maintain',
			);
		});

		it('accepts feat(`foo`)', async () => {
			await assertPass(
				'feat(`foo`): introduced',
			);
		});

		it('accepts dependency updates', async () => {
			await assertPass(
				'dep(typescript): update to latest version',
			);
		});

		it('accepts documentation updates', async () => {
			await assertPass(
				'doc(readme): improve examples',
			);
		});

		it('accepts test updates', async () => {
			await assertPass(
				'test(pr-title): improve coverage',
			);
		});
	});
});
