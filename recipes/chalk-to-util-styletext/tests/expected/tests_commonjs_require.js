const { styleText } = require("node:util");

const error = styleText("red", "Error");
const warning = styleText("yellow", "Warning");
const info = styleText("blue", "Info");

console.log(error, warning, info);
