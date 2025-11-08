const assert = require("assert");

const {
  describe,
  it
} = require("node:test");

describe("Array", function () {
  describe("#indexOf()", function () {
    it("should return -1 when the value is not present", function () {
      const arr = [1, 2, 3];
      assert.strictEqual(arr.indexOf(4), -1);
    });
  });
});
