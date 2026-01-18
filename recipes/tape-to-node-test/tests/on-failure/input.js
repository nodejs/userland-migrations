import test from 'tape';

test('failing test', (t) => {
	t.equal(1, 2, 'this will fail');
	t.end();
});

test.onFailure(() => {
	console.error('Test suite has failures');
});
