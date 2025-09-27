// dynamic import with await destructuring
const { isArray, promisify } = await import('node:util');

if (isArray(someValue)) {
  console.log('someValue is an array');
}
const p = promisify(setTimeout);
