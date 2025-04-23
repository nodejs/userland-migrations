import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { FSAbsolutePath } from './index.d.ts';

import { resolvesToNodeModule } from './resolves-to-node-module.ts';

describe('Resolves to a node module', { concurrency: true }, () => {
	const base = '/tmp/foo';
	const fileBase = `file://${base}`;
	const specifier = 'bar';
	const node_mod = `node_modules/${specifier}/whatever.ext`;

	it('should error when resolvedUrl is invalid', () => {
		const resolvedUrl = path.join(base, node_mod) as FSAbsolutePath;
		const parentLocus = 'foobar';
		let err: Error;
		try {
			resolvesToNodeModule(
				// @ts-expect-error
				resolvedUrl,
				parentLocus, // doesn't mattter
				specifier,
			);
		} catch (e) {
			err = e as Error;
		}
		assert.ok(err!);
		assert.match(err.message, /resolvedUrl/);
		assert.match(err.message, new RegExp(resolvedUrl));
		assert.match(err.message, new RegExp(parentLocus));
	});

	it('should error when resolvedUrl is missing/empty', () => {
		const parentLocus = 'foobar';
		let err: Error;
		try {
			resolvesToNodeModule(
				// @ts-expect-error
				undefined,
				parentLocus, // doesn't mattter
				specifier,
			);
		} catch (e) {
			err = e as Error;
		}
		assert.ok(err!);
		assert.equal(err.cause, `'${specifier}' in ${parentLocus}`);
	});

	it('should accepted an fs path for parentLocus & signal `true` when resolved is an immediate node module', () => {
		const isNodeModule = resolvesToNodeModule(
			`${fileBase}/${node_mod}`,
			path.join(base, 'main.js') as FSAbsolutePath,
			specifier,
		);

		assert.equal(isNodeModule, true);
	});

	it('should accepted a file url for parentLocus & signal `true` when resolved is an immediate node module', () => {
		const isNodeModule = resolvesToNodeModule(
			`${fileBase}/${node_mod}`,
			`${fileBase}/main.js`,
			specifier,
		);

		assert.equal(isNodeModule, true);
	});

	it('should signal `true` when resolved is a relevant node module', () => {
		const isNodeModule = resolvesToNodeModule(
			`${fileBase}/${node_mod}`,
			path.join(base, 'qux/zed/main.js') as FSAbsolutePath,
			specifier,
		);

		assert.equal(isNodeModule, true);
	});

	it('should signal `false` when resolved is an irrelevant node module', () => {
		const isNodeModule = resolvesToNodeModule(
			`${fileBase}/beta/${node_mod}`,
			path.join(base, 'qux/zed/main.js') as FSAbsolutePath,
			specifier,
		);

		assert.equal(isNodeModule, false);
	});
});
