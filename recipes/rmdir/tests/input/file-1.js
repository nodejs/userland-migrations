const fs = require("node:fs");

const pathName = "path/to/directory";

fs.rmdir(pathName, { recursive: true }, () => { });
fs.rmdirSync(pathName, { recursive: true });
fs.promises.rmdir(pathName, { recursive: true });
fs.rmdir(pathName, { recursive: false }); // should not be transformed
fs.rmdir(pathName); // should not be transformed
