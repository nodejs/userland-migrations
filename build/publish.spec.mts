import assert from 'node:assert/strict';
import { execPath } from 'node:process';
import {
	before,
	describe,
	it,
	mock,
} from 'node:test';

import { spawnPromisified } from './spawn-promisified.ts';


type Mock = ReturnType<typeof mock.fn>['mock'];

describe('Publishing', () => {
	const cwd = '/test';
	let mock__bundle: Mock;
	let mock__publish: Mock;

	before(async () => {
		const bundle = mock.fn();
		mock__bundle = bundle.mock;
		const publish = mock.fn();
		mock__publish = publish.mock;

		mock.module('codemod', {
			namedExports: {
				publish,
			},
		});
		mock.module('./bundle.mts', {
			namedExports: {
				bundle,
			},
		});
	});

	it('should', async () => {
		mock__bundle.mockImplementationOnce(Promise.resolve);
		mock__publish.mockImplementationOnce(Promise.resolve);

		const { code, stderr, stdout } = await spawnPromisified(
			execPath,
			[
				'--no-warnings',
				'--experimental-strip-types',
				'--recipes=("a" "b")',
				'--status=true',
				'./publish.mts',
			],
			{
				cwd,
			},
		);

		assert.equal(stderr, '');
		assert.equal(code, 0);
		assert.match(stdout, /Publishing complete/);

		assert.deepEqual(mock__bundle.calls, [
			{ arguments: [`${cwd}/a`] },
			{ arguments: [`${cwd}/b`] },
		]);

		assert.deepEqual(mock__publish.calls, [
			{ arguments: [`${cwd}/a`] },
			{ arguments: [`${cwd}/b`] },
		]);
	});
});
