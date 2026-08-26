const { styleText } = require('node:util');

console.log(styleText('red', 'Error'));
console.log(styleText('green', 'Success'));
console.log(styleText('blue', 'Info'));
