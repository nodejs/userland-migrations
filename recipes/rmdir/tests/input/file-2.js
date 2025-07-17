const { rmdir, rmdirSync, promises } = require("node:fs");

const pathName = "path/to/directory";

rmdir(pathName, { recursive: true }, () => { });
rmdirSync(pathName, { recursive: true });
promises.rmdir(pathName, { recursive: true });
rmdir(pathName, { recursive: false }); // should not be transformed
rmdir(pathName); // should not be transformed
