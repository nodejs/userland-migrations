import { test } from 'node:test';
import assert from 'node:assert';

async function fetchValue() {
    return Promise.resolve(1);
}

test("nested async tests", async (t) => {
    const value = await fetchValue();
    assert.strictEqual(value, 1, "outer assertion");
    await t.test("inner async", async (st) => {
        const inner = await fetchValue();
        assert.strictEqual(inner, 1, "inner assertion");
    });
});
