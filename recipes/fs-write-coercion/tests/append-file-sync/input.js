const fs = require("node:fs");

const data = { toString: () => "appended data" };
fs.appendFileSync("file.txt", data);
