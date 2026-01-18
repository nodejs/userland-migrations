import { test } from 'node:test';
import assert from 'node:assert';

test("deep equality", async (t) => {
    t.plan(2);
    assert.deepStrictEqual({ a: 1 }, { a: 1 }, "objects are deeply equal");
    assert.notDeepStrictEqual({ a: 1 }, { a: 2 }, "objects are not deeply equal");
});
