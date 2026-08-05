import test from "tape";

test("deep equality", (t) => {
    t.plan(2);
    t.deepEqual({ a: 1 }, { a: 1 }, "objects are deeply equal");
    t.notDeepEqual({ a: 1 }, { a: 2 }, "objects are not deeply equal");
});
