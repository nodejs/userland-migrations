import test from "tape";

test("callback style", (t) => {
    setTimeout(() => {
        t.ok(true);
        t.end();
    }, 100);
});
