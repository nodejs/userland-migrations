import test from 'tape';

test('double timeout', (t) => {
	t.timeoutAfter(100);
	t.timeoutAfter(200);
	t.end();
});
