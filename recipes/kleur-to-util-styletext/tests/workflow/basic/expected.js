import { styleText } from "node:util";

console.log(styleText("red", "Error"));
console.log(styleText("green", "Success"));
console.log(styleText("bold", "Important"));
console.log(styleText("bgRed", "Alert"));
console.log(`${styleText("blue", "[INFO]")} ${styleText("green", user)}`);
console.log("Status: " + styleText(["bold", "green"], "OK"));
