// dynamic import with namespace assignment
const util = await import('node:util');

if (util.isString(someValue)) {
  console.log('someValue is a string');
}
const p = util.promisify(setTimeout);
