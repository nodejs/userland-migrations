import { test } from 'node:test';
import assert from 'node:assert';

test("callback style", async (t) => {
	setTimeout(() => {
		assert.ok(true);
	}, 100);
});
