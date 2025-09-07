function testFunction() {
  process.assert(condition, "Assertion inside function");

  if (someCondition) {
    process.assert.deepStrictEqual(obj1, obj2, "Deep comparison");
  }

  return process.assert.ok(value) && true;
}
