class Validator {
  static validate(data) {
    process.assert(data, "Data is required");

    try {
      process.assert.strictEqual(typeof data, "object", "Data must be object");
    } catch (error) {
      process.assert.fail("Validation failed");
    }

    const results = [1, 2, 3].map(item => {
      process.assert.ok(item > 0, "Item must be positive");
      return item * 2;
    });

    return results;
  }
}
