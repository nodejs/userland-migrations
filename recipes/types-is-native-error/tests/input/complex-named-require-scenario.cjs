const {
	types: { isNativeError, isMap },
} = require("util");

if (isNativeError(err)) {
	// handle the error
}

if (isMap([])) {
}
