import { test } from 'node:test';
import assert from 'node:assert/strict';

let teardownState = 1;

test("teardown registers and runs after test", async (t) => {
    // t.plan(1);
    t.after(() => { teardownState = 0; });
    assert.strictEqual(teardownState, 1, "state before teardown");
});
