const { register: addHooks } = require("node:module");
const { pathToFileURL } = require("node:url");

addHooks("./hooks.cjs", pathToFileURL(__filename).href);
