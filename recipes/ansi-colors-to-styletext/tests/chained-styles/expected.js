const { styleText } = require('node:util');

console.log(styleText(['bold', 'red'], 'Critical error'));
console.log(styleText(['bgBlue', 'white', 'bold'], 'HEADER'));