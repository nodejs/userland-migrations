const { test } = require('node:test');
const assert = require('node:assert/strict');

test("require test", async (t) => {
    assert.strictEqual(1, 1);
    // t.end();
});
