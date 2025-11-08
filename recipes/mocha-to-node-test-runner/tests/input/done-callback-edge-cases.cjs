const assert = require("assert");

describe("Done Callback Edge Cases", function () {
  // Arrow function with done - should transform to (t, done) =>
  it("arrow function with done", (done) => {
    setTimeout(() => {
      assert.strictEqual(1 + 1, 2);
      done();
    }, 100);
  });

  // Unusual spacing in function declaration
  it("unusual spacing", function  (  done  ) {
    setTimeout(() => {
      assert.strictEqual(1 + 1, 2);
      done();
    }, 100);
  });

  // Async function with done callback - should remove done
  it("async with done", async function (done) {
    const result = await Promise.resolve(2);
    assert.strictEqual(1 + 1, result);
  });

  // Mixed: some with done, some without
  it("test without done", function () {
    assert.strictEqual(1 + 1, 2);
  });

  it("test with done after no-done", function (done) {
    setTimeout(done, 50);
  });

  // Nested describe with different function styles
  describe("nested suite", () => {
    it("nested arrow with done", (done) => {
      setTimeout(done, 50);
    });

    it("nested regular with done", function (done) {
      setTimeout(done, 50);
    });
  });

  // Multiple parameters (edge case - should not transform)
  // This is actually not valid Mocha but tests robustness
  it("multiple params", function (context, done) {
    setTimeout(done, 50);
  });

  // done as variable name inside (not parameter)
  it("done as variable", function () {
    const done = () => console.log("done");
    done();
    assert.ok(true);
  });
});
