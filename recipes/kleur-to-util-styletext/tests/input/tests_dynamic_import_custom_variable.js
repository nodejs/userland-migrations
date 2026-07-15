const foo = await import('kleur');

const error = foo.red("Error");
const warning = foo.yellow("Warning message");

console.log(error, warning);