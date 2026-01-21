import { test } from 'node:test';
import assert from 'node:assert';

test('failing test', async (t) => {
	assert.strictEqual(1, 2, 'this will fail');
});

// TODO: test.onFailure(() => {
// 	console.error('Test suite has failures');
// });
