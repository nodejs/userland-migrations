import { test } from 'node:test';
import assert from 'node:assert';

test("basic equality", async (t) => {
	t.plan(4);
	assert.strictEqual(1, 1, "equal numbers");
	assert.notStrictEqual(1, 2, "not equal numbers");
	assert.strictEqual(true, true, "strict equality");
	assert.notStrictEqual("1", 1, "not strict equality");
});
