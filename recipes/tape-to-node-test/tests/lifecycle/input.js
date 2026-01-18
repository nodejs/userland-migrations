import test from "tape";

let teardownState = 1;

test("teardown registers and runs after test", (t) => {
    t.plan(1);
    t.teardown(() => { teardownState = 0; });
    t.equal(teardownState, 1, "state before teardown");
});
