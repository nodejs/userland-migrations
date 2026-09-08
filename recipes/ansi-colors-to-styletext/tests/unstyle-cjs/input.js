const ac = require('ansi-colors');

const foo = ac.unstyle('\u001b[31mhello\u001b[39m');

console.log(foo);
