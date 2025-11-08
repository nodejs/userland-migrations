import assert from "node:assert";
function testFunction() {
  assert(condition, "Assertion inside function");

  if (someCondition) {
    assert.deepStrictEqual(obj1, obj2, "Deep comparison");
  }

  return assert.ok(value) && true;
}
