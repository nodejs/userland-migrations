import { styleText } from "node:util";

console.log(styleText("red", "Error message"));
console.log(styleText(["yellow", "bold"], "Warning message"));
