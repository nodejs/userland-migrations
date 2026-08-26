const ac = require('ansi-colors');
const file = 'server.js';
const line = '42';

console.log(`${ac.bold.red('[ERR]')} ${ac.dim(file)}:${ac.dim(line)}`);
console.log(`Multi-badge: ${ac.bgRed.white(' ERR ')} ${ac.bgGreen.black(' OK ')}`);