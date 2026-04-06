import { test } from 'node:test';
import assert from 'node:assert';

test.skip('skipped test', (t) => {
	assert.fail('should not run');
});

test.only('only test', (t) => {
	// TODO: t.pass('should run')
// TODO: Manual migration: consider t.diagnostic(message) for informational output, or remove this call.;
});
