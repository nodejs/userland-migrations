const { red, yellow } = await import('kleur');

const error = red("Error");
const warning = yellow("Warning message");

console.log(error, warning);
