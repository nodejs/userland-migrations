import util from 'node:util';

if (typeof someValue === 'function') {
    console.log('someValue is a function');
}
const p = util.promisify(setTimeout);
