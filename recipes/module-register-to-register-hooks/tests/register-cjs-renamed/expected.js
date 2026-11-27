const { registerHooks: addHooks } = require("node:module");
const { pathToFileURL } = require("node:url");

addHooks(require("./hooks.cjs"));
