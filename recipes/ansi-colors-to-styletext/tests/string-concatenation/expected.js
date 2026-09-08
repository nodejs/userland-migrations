const { styleText } = require('node:util');

console.log('Hello, ' + styleText('green', 'World') + '!');
console.log(styleText(['bgRedBright', 'white'], ' ERR ') + ' ' + styleText('red', 'File not found'));