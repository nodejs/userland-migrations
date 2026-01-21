import { test } from 'node:test';
import assert from 'node:assert';

test("nested tests", (t) => {
	t.plan(1);
	t.test("inner test 1", (st) => {
		st.plan(1);
		assert.strictEqual(1, 1, "inner assertion");
	});
});
