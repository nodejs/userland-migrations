const util = require("node:util");

const check = util.types.isWebAssemblyCompiledModule(data) ? "module" : "not module";
