const { writeFileSync, appendFileSync } = require("node:fs");

const data = { toString: () => "file content" };
writeFileSync("file.txt", String(data));
appendFileSync("log.txt", String(data));
