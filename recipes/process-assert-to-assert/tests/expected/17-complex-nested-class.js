// Unable to determine module type; please add the appropriate import for 'assert'
class Validator {
  static validate(data) {
    assert(data, "Data is required");

    try {
      assert.strictEqual(typeof data, "object", "Data must be object");
    } catch (error) {
      assert.fail("Validation failed");
    }

    const results = [1, 2, 3].map(item => {
      assert.ok(item > 0, "Item must be positive");
      return item * 2;
    });

    return results;
  }
}
