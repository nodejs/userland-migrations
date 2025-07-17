const fs = require("node:fs");

const pathName = "path/to/directory";

fs.rm(pathName, { recursive: true, force: true }, () => { });
fs.rmSync(pathName, { recursive: true, force: true });
fs.promises.rm(pathName, { recursive: true, force: true });
fs.rmdir(pathName, { recursive: false }); // should not be transformed
fs.rmdir(pathName); // should not be transformed
