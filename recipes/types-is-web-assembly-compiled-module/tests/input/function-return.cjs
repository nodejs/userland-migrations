const { types } = require("node:util");

function isWasmModule(value) {
  return types.isWebAssemblyCompiledModule(value);
}
