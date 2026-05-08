// dynamic import with namespace assignment
const util = await import('node:util');

if (typeof someValue === 'string') {
  console.log('someValue is a string');
}
const p = util.promisify(setTimeout);
