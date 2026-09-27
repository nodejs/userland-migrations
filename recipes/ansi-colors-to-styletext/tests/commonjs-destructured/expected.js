const { styleText } = require('node:util');

console.log(styleText('red', 'Error'));
console.log(styleText('blue', 'Info'));
console.log(styleText('bold', 'Important'));