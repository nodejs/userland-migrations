import util from 'node:util';

if (util.isFunction(someValue)) {
    console.log('someValue is a function');
}
const p = util.promisify(setTimeout);
