const { isArray, promisify } = require('node:util');

if (isArray(someValue)) {
    console.log('someValue is an array');
}
const p = promisify(setTimeout);
