import { test } from 'node:test';
import assert from 'node:assert';

function someAsyncThing() {
    return new Promise((resolve) => setTimeout(() => resolve(true), 50));
}

test("async test with promises", async (t) => {
    // t.plan(1);
    const result = await someAsyncThing();
    assert.ok(result, "async result is truthy");
});
