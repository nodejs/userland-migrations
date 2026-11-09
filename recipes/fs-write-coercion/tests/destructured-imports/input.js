const { writeFileSync, appendFileSync } = require("node:fs");

const data = { toString: () => "file content" };
writeFileSync("file.txt", data);
appendFileSync("log.txt", data);
