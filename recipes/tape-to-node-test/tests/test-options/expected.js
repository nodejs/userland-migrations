import { test } from 'node:test';
import assert from 'node:assert';

test.skip('skipped test', (t) => {
	assert.fail('should not run');
});

test.only('only test', (t) => {
	assert.ok(true, 'should run');
});
