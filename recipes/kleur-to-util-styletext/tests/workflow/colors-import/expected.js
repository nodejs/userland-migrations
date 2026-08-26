import { styleText } from "node:util";

console.log(styleText("red", "Error"));
console.log(styleText("green", "OK") + " " + styleText("dim", name));
console.log(styleText(["bgRed", "white"], "FAIL"));
