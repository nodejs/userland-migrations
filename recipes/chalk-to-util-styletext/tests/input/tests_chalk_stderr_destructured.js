const { chalkStderr } = require("chalk");

console.error(chalkStderr.red("Error from stderr"));
console.error(chalkStderr.yellow.bold("Warning from stderr"));
