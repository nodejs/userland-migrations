import { isArray, isBoolean } from 'node:util'; import fs from 'node:fs';

if (isArray(someValue)) {
	console.log('someValue is an array');
}
if (isBoolean(someValue)) {
	console.log('someValue is a boolean');
}
