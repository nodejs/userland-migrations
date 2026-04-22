
if (Array.isArray(someValue)) {
	console.log('someValue is an array');
}
if (typeof someValue === 'boolean') {
	console.log('someValue is a boolean');
}
if (Buffer.isBuffer(someValue)) {
	console.log('someValue is a buffer');
}
if (someValue instanceof Date) {
	console.log('someValue is a date');
}
if (Error.isError(someValue)) {
	console.log('someValue is an error');
}
if (typeof someValue === 'function') {
	console.log('someValue is a function');
}
if (someValue === null) {
	console.log('someValue is null');
}
if (someValue === null || someValue === undefined) {
	console.log('someValue is null or undefined');
}
if (typeof someValue === 'number') {
	console.log('someValue is a number');
}
if (someValue && typeof someValue === 'object') {
	console.log('someValue is an object');
}
if (Object(someValue) !== someValue) {
	console.log('someValue is a primitive');
}
if (someValue instanceof RegExp) {
	console.log('someValue is a regular expression');
}
if (typeof someValue === 'string') {
	console.log('someValue is a string');
}
if (typeof someValue === 'symbol') {
	console.log('someValue is a symbol');
}
if (typeof someValue === 'undefined') {
	console.log('someValue is undefined');
}
