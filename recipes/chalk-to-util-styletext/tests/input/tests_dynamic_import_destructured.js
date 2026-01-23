const { red, yellow } = await import('chalk');

const error = red("Error");
const warning = yellow("Warning message");

console.log(error, warning);
