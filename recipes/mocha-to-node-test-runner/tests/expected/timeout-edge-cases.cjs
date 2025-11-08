const assert = require("assert");


const {
  describe,
  it
} = require("node:test");

const CUSTOM_TIMEOUT = 5000;

describe("Timeout Edge Cases", function () {
  // Arrow function with timeout
  it("arrow with timeout", { timeout: 1000 }, () => {
    assert.ok(true);
  });

  // Timeout with variable instead of literal
  it("timeout with variable", { timeout: CUSTOM_TIMEOUT }, function() {
    assert.ok(true);
  });

  // Unusual spacing
  it("unusual spacing", function () {
    this  .  timeout  (  500  );
    assert.ok(true);
  });

  // Timeout not at the beginning of function
  it("timeout not at beginning", function () {
    const x = 1 + 1;
    assert.strictEqual(x, 2);
    this.timeout(1000);
  });

  // Multiple timeout calls (edge case)
  it("multiple timeouts", { timeout: 1000 }, function() {
    this.timeout(2000); // Override
    assert.ok(true);
  });

  // Timeout with done callback
  it("timeout with done", { timeout: 1000 }, function(t, done) {
    setTimeout(done, 100);
  });

  // Timeout with this.skip()
  it("timeout with skip", { timeout: 1000 }, function(t) {
    t.skip();
  });

  // Timeout in describe block
  describe("nested with timeout", { timeout: 3000 }, function() {
    it("inherits timeout", function () {
      assert.ok(true);
    });

    it("overrides timeout", { timeout: 500 }, function() {
      assert.ok(true);
    });
  });

  // Timeout with complex expression
  it("timeout with expression", { timeout: 100 * 10 }, function() {
    assert.ok(true);
  });

  // Different whitespace patterns
  it("no space before paren", { timeout: 1000 }, function() {
    assert.ok(true);
  });

  it("extra spaces in params", { timeout:  1000  }, function( ) {
    assert.ok(true);
  });

  // Async function with timeout
  it("async with timeout", { timeout: 2000 }, async function() {
    await Promise.resolve();
    assert.ok(true);
  });

  // Arrow function with done and timeout (combination)
  it("arrow done and timeout", { timeout: 1000 }, (t, done) => {
    setTimeout(done, 100);
  });
});
