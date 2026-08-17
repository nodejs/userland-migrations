const { styleText } = require("node:util");

const name = "World";
const action = "ready";
console.log("Hello, " + styleText("green", name) + "!");
console.log(`${styleText("blue", "[INFO]")} User ${styleText("green", name)} is ${styleText("yellow", action)}`);
