
const { rm, rmdir, rmSync, promises } = require("node:fs");

const pathName = "path/to/directory";

rm(pathName, { recursive: true, force: true }, () => { });
rmSync(pathName, { recursive: true, force: true });
promises.rm(pathName, { recursive: true, force: true });
rmdir(pathName, { recursive: false }); // should not be transformed
rmdir(pathName); // should not be transformed
