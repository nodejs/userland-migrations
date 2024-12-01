import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getNotFoundUrl } from './get-not-found-url.ts';

describe('Get module not found url', () => {
	const errPath = '/tmp/foo.js';
	const errUrl = `file://${errPath}`;
	function makeError(setUrlProp = false) {
		const err = new Error(
			['[ERR_MODULE_NOT_FOUND]: Cannot find module', `'${errPath}'`, 'imported from /tmp/bar'].join(
				' ',
			),
		);

		if (setUrlProp) Object.assign(err, { url: errPath });

		return err;
	}

	it('should use `error.url` when available', () => {
		assert.equal(getNotFoundUrl(makeError(true)), errUrl);
	});

	it('should parse from `error.message` when `error.url` is not available', () => {
		assert.equal(getNotFoundUrl(makeError(false)), errUrl);
	});
});
