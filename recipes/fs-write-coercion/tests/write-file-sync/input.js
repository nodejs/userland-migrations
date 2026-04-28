const fs = require("node:fs");

const data = { toString: () => "file content" };
fs.writeFileSync("file.txt", data);
