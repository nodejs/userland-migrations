const { test } = require('node:test');
const assert = require('node:assert');

test('new features', async (t) => {
	assert.strictEqual(1, 1, 'equals alias');
	assert.strictEqual(1, 1, 'is alias');
	assert.notStrictEqual(1, 2, 'notEquals alias');
	assert.equal(1, '1', 'looseEqual');
	assert.notEqual(1, '2', 'notLooseEqual');
	assert.deepEqual({ a: 1 }, { a: '1' }, 'deepLooseEqual');
	t.diagnostic('this is a comment');
	assert.ok(!false, 'notOk');
});

// TODO: test.onFinish(() => {
// 	console.log('finished');
// });
