import { test } from 'node:test';
import assert from 'node:assert';

test('some test', async (t) => {
	assert.ok(true, 'assertion passes');
});

// TODO: test.onFinish(() => {
// 	console.log('All tests finished');
// });
