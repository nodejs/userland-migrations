import proc from 'node:process';
const { exit } = require('node:process');

proc.exit(false);
exit(2.3);
proc.exitCode = true;
