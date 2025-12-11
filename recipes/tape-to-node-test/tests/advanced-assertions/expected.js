import { test } from 'node:test';
import assert from 'node:assert';

test('advanced assertions', async (t) => {
    assert.throws(() => { throw new Error('fail'); }, /fail/);
    assert.doesNotThrow(() => { });
    assert.match('string', /ring/);
    assert.doesNotMatch('string', /gnirt/);
    assert.fail('this should fail');
    assert.ifError(null);
    assert.ifError(null);
    // t.end();
});
