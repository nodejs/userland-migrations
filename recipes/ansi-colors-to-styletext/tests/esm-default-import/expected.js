import { styleText } from 'node:util';

console.log(styleText('red', 'Error'));
console.log(styleText(['bold', 'green'], 'Success'));