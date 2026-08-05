const assert = require("node:assert");

assert.throws(
  () => fs.readFile("file.txt", 123),
  { code: "ERR_INVALID_CALLBACK" }
);
