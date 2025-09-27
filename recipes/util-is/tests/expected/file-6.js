const { promisify } = require('node:util');

if (Array.isArray(someValue)) {
    console.log('someValue is an array');
}
const p = promisify(setTimeout);
