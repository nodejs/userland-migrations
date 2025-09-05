const util = require('node:util');

if (typeof someValue === 'string') {
    console.log('someValue is a string');
}
const p = util.promisify(setTimeout);
