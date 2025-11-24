const util = require("node:util");

if (!util.types.isWebAssemblyCompiledModule(value)) {
  throw new Error("Not a WebAssembly module");
}
