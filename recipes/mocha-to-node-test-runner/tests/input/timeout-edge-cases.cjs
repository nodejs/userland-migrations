const assert = require("assert");

const CUSTOM_TIMEOUT = 5000;

describe("Timeout Edge Cases", function () {
  // Arrow function with timeout
  it("arrow with timeout", () => {
    this.timeout(1000);
    assert.ok(true);
  });

  // Timeout with variable instead of literal
  it("timeout with variable", function () {
    this.timeout(CUSTOM_TIMEOUT);
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
  it("multiple timeouts", function () {
    this.timeout(1000);
    this.timeout(2000); // Override
    assert.ok(true);
  });

  // Timeout with done callback
  it("timeout with done", function (done) {
    this.timeout(1000);
    setTimeout(done, 100);
  });

  // Timeout with this.skip()
  it("timeout with skip", function () {
    this.timeout(1000);
    this.skip();
  });

  // Timeout in describe block
  describe("nested with timeout", function () {
    this.timeout(3000);

    it("inherits timeout", function () {
      assert.ok(true);
    });

    it("overrides timeout", function () {
      this.timeout(500);
      assert.ok(true);
    });
  });

  // Timeout with complex expression
  it("timeout with expression", function () {
    this.timeout(100 * 10);
    assert.ok(true);
  });

  // Different whitespace patterns
  it("no space before paren", function(){
    this.timeout(1000);
    assert.ok(true);
  });

  it("extra spaces in params", function ( ) {
    this.timeout( 1000 );
    assert.ok(true);
  });

  // Async function with timeout
  it("async with timeout", async function () {
    this.timeout(2000);
    await Promise.resolve();
    assert.ok(true);
  });

  // Arrow function with done and timeout (combination)
  it("arrow done and timeout", (done) => {
    this.timeout(1000);
    setTimeout(done, 100);
  });
});
