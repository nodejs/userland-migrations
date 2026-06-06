const { styleText } = require("node:util");

console.log(styleText("red", "Error"));
console.log(styleText(["bold", "yellow"], "Warning"));
