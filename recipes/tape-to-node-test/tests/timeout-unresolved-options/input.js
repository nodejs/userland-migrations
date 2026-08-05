import test from 'tape';

function getOpts() {
	return { skip: false };
}

const opts = getOpts();

test('timeout with unresolved opts', opts, (t) => {
	t.timeoutAfter(123);
	t.ok(true);
});
