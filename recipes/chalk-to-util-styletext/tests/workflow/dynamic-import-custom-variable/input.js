const foo = await import('chalk');

const error = foo.red("Error");
const warning = foo.yellow("Warning message");

console.log(error, warning);