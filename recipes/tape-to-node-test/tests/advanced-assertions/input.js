import test from 'tape';

test('advanced assertions', (t) => {
	t.throws(() => { throw new Error('fail'); }, /fail/);
	t.doesNotThrow(() => { });
	t.match('string', /ring/);
	t.doesNotMatch('string', /gnirt/);
	t.fail('this should fail');
	t.error(null);
	t.ifError(null);
});
