const assert = require("assert");
const { describe, it } = require("node:test");
describe("Skipped Test", () => {
  it.skip("should not run this test", function () {
    assert.strictEqual(1 + 1, 3);
  });
  it("should also be skipped", function(t) {
    assert.strictEqual(1 + 1, 3);
    t.skip();
  });
});
