import proc from 'node:process';
const { exit } = require('node:process');

proc.exit(0);
exit(Math.floor(2.3));
proc.exitCode = 0;
