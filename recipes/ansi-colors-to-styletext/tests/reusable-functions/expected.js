const { styleText } = require('node:util');
const errorStyle = (msg) => styleText(['bold', 'red'], msg);
const status = level === 'error' ? styleText(['bold', 'red'], 'boom') : styleText('yellow', 'slow');