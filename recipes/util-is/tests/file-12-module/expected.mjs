// dynamic import with await destructuring
const { promisify } = await import('node:util');

if (Array.isArray(someValue)) {
  console.log('someValue is an array');
}
const p = promisify(setTimeout);
