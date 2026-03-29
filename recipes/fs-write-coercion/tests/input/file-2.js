const fs = require("node:fs");

const obj = { toString: () => "content" };
fs.writeFile("file.txt", obj, (err) => {
  if (err) throw err;
});
