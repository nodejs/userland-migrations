const ac = require('ansi-colors');

console.log('Hello, ' + ac.green('World') + '!');
console.log(ac.bgRedBright.white(' ERR ') + ' ' + ac.red('File not found'));