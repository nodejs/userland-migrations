const fs = require("node:fs");

const obj = { toString: () => "content" };
fs.writeFile("file.txt", String(obj), (err) => {
  if (err) throw err;
});
