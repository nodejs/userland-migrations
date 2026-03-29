const fs = require("node:fs");

const fd = fs.openSync("file.txt", "w");
const data = { toString: () => "buffer content" };
fs.write(fd, String(data), (err) => {
  if (err) throw err;
  fs.closeSync(fd);
});
