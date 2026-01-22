import test from 'tape';

test.skip('skipped test', (t) => {
	t.fail('should not run');
});

test.only('only test', (t) => {
	t.pass('should run');
});
