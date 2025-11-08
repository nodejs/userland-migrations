import assert from "assert";

import { describe, it } from "node:test";

describe("Array with imports", function () {
  describe("#indexOf()", function () {
    it("should return -1 when the value is not present", function () {
      const arr = [1, 2, 3];
      assert.strictEqual(arr.indexOf(4), -1);
    });

    it("should return the correct index when value is present", function () {
      const arr = [1, 2, 3];
      assert.strictEqual(arr.indexOf(2), 1);
    });
  });
});
