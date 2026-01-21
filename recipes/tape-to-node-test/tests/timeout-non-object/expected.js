import { test } from 'node:test';
import assert from 'node:assert';

const opts = { skip: false };

test('timeout with variable opts', opts, (t) => {
	// TODO(codemod@nodejs/tape-to-node-test): Add timeout: `123` to test options manually;
	assert.ok(true);
});
