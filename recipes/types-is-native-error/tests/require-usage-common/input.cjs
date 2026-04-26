const util = require("node:util");
const { types } = require("util");
const {
	types: { isNativeError },
} = require("util");
const err = new Error();

if (util.types.isNativeError(err)) {
	// handle the error
}

if (types.isNativeError(err)) {
	// handle the error
}

if (isNativeError(err)) {
	// handle the error
}
