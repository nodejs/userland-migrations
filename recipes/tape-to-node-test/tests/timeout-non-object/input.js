import test from 'tape';

const opts = { skip: false };

test('timeout with variable opts', opts, (t) => {
	t.timeoutAfter(123);
	t.end();
});
