import { styleText } from "node:util";

console.log(styleText(["bgRed", "white"], "Error on red background"));
console.log(styleText(["bgGreen", "black"], "Success on green background"));
console.log(styleText(["bgBlue", "whiteBright"], "Info on blue background"));
