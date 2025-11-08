const assert = require("assert");
const fs = require("fs");
describe("File System", function () {
  before(function () {
    fs.writeFileSync("test.txt", "Hello, World!");
  });

  after(function () {
    fs.unlinkSync("test.txt");
  });

  it("should read the file", function () {
    const content = fs.readFileSync("test.txt", "utf8");
    assert.strictEqual(content, "Hello, World!");
  });
});
