import { test } from 'node:test';
import assert from 'node:assert';

test('plan only', (t) => {
	t.plan(1);
	assert.strictEqual(1, 1, 'keeps assert');
});
