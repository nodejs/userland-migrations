import { test } from 'node:test';
import assert from 'node:assert';

test("truthiness", async (t) => {
    // t.plan(4);
    assert.ok(true, "true is ok");
    assert.ok(!false, "false is not ok");
    assert.ok(true, "explicitly true");
    assert.ok(!false, "explicitly false");
    assert.ok(true, "this passed");
});
