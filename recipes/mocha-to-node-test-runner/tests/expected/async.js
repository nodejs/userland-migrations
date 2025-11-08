const assert = require("assert");

const {
  describe,
  it
} = require("node:test");

describe("Async Test", function () {
  it("should complete after a delay", async function() {
    const result = await new Promise((resolve) =>
      setTimeout(() => resolve(42), 100),
    );
    assert.strictEqual(result, 42);
  });
});
