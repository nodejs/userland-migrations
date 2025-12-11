import { test } from 'node:test';
import assert from 'node:assert/strict';

test('aliased test', async (t) => {
    assert.strictEqual(1, 1);
    // t.end();
});
