import { test } from 'node:test';
import assert from 'node:assert';

test.skip('skipped test', async (t) => {
    assert.fail('should not run');
    // t.end();
});

test.only('only test', async (t) => {
    assert.ok(true, 'should run');
    // t.end();
});
