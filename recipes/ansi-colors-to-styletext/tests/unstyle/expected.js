import { stripVTControlCharacters } from 'node:util';

const foo = stripVTControlCharacters('\u001b[34mhello\u001b[39m');

console.log(foo);
