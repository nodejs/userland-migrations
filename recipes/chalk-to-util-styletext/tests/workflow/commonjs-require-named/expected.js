const { styleText } = require("node:util");

const error = styleText("red", "Error");
const warning = styleText("yellow", "Warning message");

console.log(error, warning);
