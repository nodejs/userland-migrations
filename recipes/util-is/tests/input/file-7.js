const util = require('node:util');

if (util.isString(someValue)) {
    console.log('someValue is a string');
}
const p = util.promisify(setTimeout);
