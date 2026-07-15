const { red: foo, yellow: bar } = require("kleur");

const error = foo("Error");
const warning = bar("Warning message");

console.log(error, warning);
