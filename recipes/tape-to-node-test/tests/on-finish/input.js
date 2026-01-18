import test from 'tape';

test('some test', (t) => {
	t.ok(true, 'assertion passes');
	t.end();
});

test.onFinish(() => {
	console.log('All tests finished');
});
