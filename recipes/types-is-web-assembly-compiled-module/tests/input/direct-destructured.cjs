const { isWebAssemblyCompiledModule } = require("node:util").types;

if (isWebAssemblyCompiledModule(compiledModule)) {
  // do something
}
