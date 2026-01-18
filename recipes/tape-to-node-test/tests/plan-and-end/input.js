import test from "tape";

test("basic equality", (t) => {
	t.plan(4);
	t.equal(1, 1, "equal numbers");
	t.notEqual(1, 2, "not equal numbers");
	t.strictEqual(true, true, "strict equality");
	t.notStrictEqual("1", 1, "not strict equality");
	t.end();
});
