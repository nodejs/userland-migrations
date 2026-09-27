const { stripVTControlCharacters } = require('node:util');

const foo = stripVTControlCharacters('\u001b[31mhello\u001b[39m');

console.log(foo);
