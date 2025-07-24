const util = require('node:util');

if (util.isArray(someValue)) {
	console.log('someValue is an array');
}
if (util.isBoolean(someValue)) {
	console.log('someValue is a boolean');
}
if (util.isBuffer(someValue)) {
	console.log('someValue is a buffer');
}
if (util.isDate(someValue)) {
	console.log('someValue is a date');
}
if (util.isError(someValue)) {
	console.log('someValue is an error');
}
if (util.isFunction(someValue)) {
	console.log('someValue is a function');
}
if (util.isNull(someValue)) {
	console.log('someValue is null');
}
if (util.isNullOrUndefined(someValue)) {
	console.log('someValue is null or undefined');
}
if (util.isNumber(someValue)) {
	console.log('someValue is a number');
}
if (util.isObject(someValue)) {
	console.log('someValue is an object');
}
if (util.isPrimitive(someValue)) {
	console.log('someValue is a primitive');
}
if (util.isRegExp(someValue)) {
	console.log('someValue is a regular expression');
}
if (util.isString(someValue)) {
	console.log('someValue is a string');
}
if (util.isSymbol(someValue)) {
	console.log('someValue is a symbol');
}
if (util.isUndefined(someValue)) {
	console.log('someValue is undefined');
}
