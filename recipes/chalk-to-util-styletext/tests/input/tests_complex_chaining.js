const chalk = require("chalk");

const b = true;
const c = b ? chalk.bold : chalk.underline;

console.log(c("Conditional style"));
