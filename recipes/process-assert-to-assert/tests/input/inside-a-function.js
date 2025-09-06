function validateInput(input) {
  process.assert(typeof input === "string", "Input must be string");
  return input.trim();
}
