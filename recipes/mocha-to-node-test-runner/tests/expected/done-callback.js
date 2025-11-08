const assert = require("assert");

const {
  describe,
  it
} = require("node:test");

describe("Callback Test", function () {
  it("should call done when complete", function (t, done) {
    setTimeout(() => {
      assert.strictEqual(1 + 1, 2);
      done();
    }, 100);
  });
});
