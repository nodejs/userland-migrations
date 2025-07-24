const { isArray, isBoolean } = require('node:util');

if (isArray(someValue)) {
	console.log('someValue is an array');
}
if (isBoolean(someValue)) {
	console.log('someValue is a boolean');
}
