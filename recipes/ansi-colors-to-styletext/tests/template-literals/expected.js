const { styleText } = require('node:util');
const file = 'server.js';
const line = '42';

console.log(`${styleText(['bold', 'red'], '[ERR]')} ${styleText('dim', file)}:${styleText('dim', line)}`);
console.log(`Multi-badge: ${styleText(['bgRed', 'white'], ' ERR ')} ${styleText(['bgGreen', 'black'], ' OK ')}`);