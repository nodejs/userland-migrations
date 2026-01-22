const test = require('tape');

test('new features', (t) => {
	t.equals(1, 1, 'equals alias');
	t.is(1, 1, 'is alias');
	t.notEquals(1, 2, 'notEquals alias');
	t.looseEqual(1, '1', 'looseEqual');
	t.notLooseEqual(1, '2', 'notLooseEqual');
	t.deepLooseEqual({ a: 1 }, { a: '1' }, 'deepLooseEqual');
	t.comment('this is a comment');
	t.notOk(false, 'notOk');
});

test.onFinish(() => {
	console.log('finished');
});
