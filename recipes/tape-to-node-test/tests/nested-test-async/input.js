import test from "tape";

async function fetchValue() {
    return Promise.resolve(1);
}

test("nested async tests", async (t) => {
    const value = await fetchValue();
    t.equal(value, 1, "outer assertion");
    await t.test("inner async", async (st) => {
        const inner = await fetchValue();
        st.equal(inner, 1, "inner assertion");
    });
});
