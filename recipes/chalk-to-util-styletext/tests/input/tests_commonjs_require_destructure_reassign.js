const { red: foo, yellow: bar } = require("chalk");

const error = foo("Error");
const warning = bar("Warning message");

console.log(error, warning);
