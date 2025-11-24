const util = require("node:util");
const { types } = require("util");
const {
	types: { isWebAssemblyCompiledModule },
} = require("util");
const value = {};

if (util.types.isWebAssemblyCompiledModule(value)) {
	// handle
}

if (types.isWebAssemblyCompiledModule(value)) {
	// handle
}

if (isWebAssemblyCompiledModule(value)) {
	// handle
}
