import test from 'tape';

test('failing test', (t) => {
	t.equal(1, 2, 'this will fail');
});

test.onFailure(() => {
	console.error('Test suite has failures');
});
