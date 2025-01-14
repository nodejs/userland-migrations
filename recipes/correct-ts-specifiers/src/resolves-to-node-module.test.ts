import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { FSAbsolutePath } from './types.ts';

import { resolvesToNodeModule } from './resolves-to-node-module.ts';

describe('Resolves to a node module', () => {
	const base = '/tmp/foo';
	const fileBase = `file://${base}`;
	const node_mod = 'node_modules/bar/whatever.ext';

	it('should error when arguments are invalid', () => {
		assert.throws(() =>
			resolvesToNodeModule(
				// @ts-ignore that's the point of this test
				path.join(base, node_mod) as FSAbsolutePath,
				'', // doesn't mattter
			),
		);
	});

	it('should accepted an fs path for parentLocus & signal `true` when resolved is an immediate node module', () => {
		const isNodeModule = resolvesToNodeModule(
			`${fileBase}/${node_mod}`,
			path.join(base, 'main.js') as FSAbsolutePath,
		);

		assert.equal(isNodeModule, true);
	});

	it('should accepted a file url for parentLocus & signal `true` when resolved is an immediate node module', () => {
		const isNodeModule = resolvesToNodeModule(`${fileBase}/${node_mod}`, `${fileBase}/main.js`);

		assert.equal(isNodeModule, true);
	});

	it('should signal `true` when resolved is a relevant node module', () => {
		const isNodeModule = resolvesToNodeModule(
			`${fileBase}/${node_mod}`,
			path.join(base, 'qux/zed/main.js') as FSAbsolutePath,
		);

		assert.equal(isNodeModule, true);
	});

	it('should signal `false` when resolved is an irrelevant node module', () => {
		const isNodeModule = resolvesToNodeModule(
			`${fileBase}/beta/${node_mod}`,
			path.join(base, 'qux/zed/main.js') as FSAbsolutePath,
		);

		assert.equal(isNodeModule, false);
	});
});
