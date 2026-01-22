import test from 'tape';

test('plan only', (t) => {
	t.plan(1);
	t.equal(1, 1, 'keeps assert');
});
