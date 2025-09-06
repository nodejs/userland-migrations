import assert from "node:assert";
function validateInput(input) {
  assert(typeof input === "string", "Input must be string");
  return input.trim();
}