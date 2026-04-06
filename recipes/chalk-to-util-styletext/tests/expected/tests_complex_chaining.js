const { styleText } = require("node:util");

const b = true;
const c = b ? (text) => styleText("bold", text) : (text) => styleText("underline", text);

console.log(c("Conditional style"));
