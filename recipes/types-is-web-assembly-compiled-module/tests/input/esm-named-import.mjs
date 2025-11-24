import { types } from "node:util";

if (types.isWebAssemblyCompiledModule(obj)) {
  return true;
}
