const { registerHooks } = require("node:module");
const { pathToFileURL } = require("node:url");

registerHooks(require("./hooks.mjs"));
