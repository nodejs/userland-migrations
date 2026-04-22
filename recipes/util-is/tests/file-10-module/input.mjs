import { isArray as arrayCheck, isString as str } from 'node:util';

if (arrayCheck(someValue)) {
    console.log('someValue is an array');
}
if (str(someValue)) {
    console.log('someValue is a string');
}
