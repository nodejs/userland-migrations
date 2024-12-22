import assert from 'node:assert/strict';
import { cwd, argv } from 'node:process';
import {
	before,
	describe,
	it,
	mock,
} from 'node:test';


type Mock = ReturnType<typeof mock.fn>['mock'];

describe('Publishing', () => {
	const CWD = cwd();
	const outfile = 'out.js';
	let mock__bundle: Mock;
	let mock__publish: Mock;
	let mock__consoleErr: Mock;
	let mock__consoleLog: Mock;

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
				outfile,
			},
		});
		// mock.method(console, 'error');
		// mock.method(console, 'log');
	});

	it('should', async () => {
		mock__bundle.mockImplementation(async () => { });
		mock__publish.mockImplementation(() => { });

		argv[2] = '--recipes=("a" "b")';
		argv[3] = '--status';

		await import('./publish.mts');

		assert.deepEqual(mock__bundle.calls, [
			{ arguments: [`${CWD}/a`] },
			{ arguments: [`${CWD}/b`] },
		]);

		assert.deepEqual(mock__publish.calls, [
			{ arguments: [`${CWD}/a`] },
			{ arguments: [`${CWD}/b`] },
		]);

		assert.match(mock__consoleLog.calls[0].arguments[0], /Publishing complete/);
	});
});
