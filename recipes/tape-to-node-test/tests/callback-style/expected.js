import { test } from 'node:test';
import assert from 'node:assert';

test("callback style", (t) => {
	setTimeout(() => {
		assert.ok(true);
	}, 100);
});
