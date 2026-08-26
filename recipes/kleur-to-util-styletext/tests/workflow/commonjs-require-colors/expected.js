const { styleText } = require("node:util");

console.log(styleText("red", "Error"));
console.log(styleText("green", "OK"));
console.log(styleText(["bgRed", "white"], "FAIL"));
