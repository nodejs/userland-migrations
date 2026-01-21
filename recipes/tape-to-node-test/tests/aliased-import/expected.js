import { test } from 'node:test';
import assert from 'node:assert';

test('aliased test', (t) => {
	assert.strictEqual(1, 1);
});
