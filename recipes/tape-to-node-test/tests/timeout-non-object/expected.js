import { test } from 'node:test';
import assert from 'node:assert';

const opts = { skip: false, signal: AbortSignal.timeout(123) };

test('timeout with variable opts', opts, (t) => {
	assert.ok(true);
});
