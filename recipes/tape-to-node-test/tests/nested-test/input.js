import test from "tape";

test("nested tests", (t) => {
    t.plan(1);
    t.test("inner test 1", (st) => {
        st.plan(1);
        st.equal(1, 1, "inner assertion");
    });
});
