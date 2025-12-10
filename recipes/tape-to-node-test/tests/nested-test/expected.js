import { test } from 'node:test';
import assert from 'node:assert/strict';

test("nested tests", async (t) => {
    // t.plan(1);
    await t.test("inner test 1", async (st) => {
        // st.plan(1);
        assert.strictEqual(1, 1, "inner assertion");
    });
});
