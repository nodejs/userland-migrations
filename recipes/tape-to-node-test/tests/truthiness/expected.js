import { test } from 'node:test';
import assert from 'node:assert';

test("truthiness", (t) => {
    t.plan(4);
    assert.ok(true, "true is ok");
    assert.ok(!false, "false is not ok");
    assert.ok(true, "explicitly true");
    assert.ok(!false, "explicitly false");
    // TODO: t.pass("this passed")
// TODO: Manual migration: consider t.diagnostic(message) for informational output, or remove this call.;
});
