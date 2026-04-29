const { isBoolean: isBooleanChecker } = require('node:util');

if (isBooleanChecker(someValue)) {
	console.log('someValue is a boolean');
}
