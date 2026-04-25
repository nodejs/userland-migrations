import test from 'tape';

test.skip('skipped test', (t) => {
	t.fail('should not run');
});

test.only('only test', (t) => {
	t.pass('should run');
});

test?.skip('skipped test', (t) => {
	assert.fail('should not run');
});

test
	.skip('skipped test', (t) => {
		assert.fail('should not run');
	});

test.only('only test', (t) => {
	// TODO: t.pass('should run')
	// TODO: Manual migration: consider t.diagnostic(message) for informational output, or remove this call.;
});

test?.only('only test', (t) => {
	// TODO: t.pass('should run')
	// TODO: Manual migration: consider t.diagnostic(message) for informational output, or remove this call.;
});
