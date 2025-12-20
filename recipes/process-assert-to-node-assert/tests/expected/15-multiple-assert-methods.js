import assert from "node:assert";
assert(condition);
assert.ok(value);
assert.strictEqual(a, b);
assert.notStrictEqual(a, c);
assert.throws(() => { throw new Error(); });
