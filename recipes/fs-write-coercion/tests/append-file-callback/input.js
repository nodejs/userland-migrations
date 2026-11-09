const fs = require("node:fs");

const content = { toString: () => "more content" };
fs.appendFile("file.txt", content, (err) => {
  if (err) throw err;
});
