const ac = require('ansi-colors');
const errorStyle = (msg) => ac.bold.red(msg);
const status = level === 'error' ? ac.bold.red('boom') : ac.yellow('slow');