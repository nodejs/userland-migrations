const util = require("node:util");

if (util.types.isWebAssemblyCompiledModule(value)) {
  console.log("It's a WebAssembly module");
}
