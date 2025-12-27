import test from "tape";

test("truthiness", (t) => {
    t.plan(4);
    t.ok(true, "true is ok");
    t.notOk(false, "false is not ok");
    t.true(true, "explicitly true");
    t.false(false, "explicitly false");
    t.pass("this passed");
});
