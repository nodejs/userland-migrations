import { styleText } from "node:util";

console.log(styleText(["red", "bold"], "Error: Operation failed"));
console.log(styleText(["green", "underline"], "Success: All tests passed"));
console.log(styleText(["yellow", "bgBlack"], "Warning: Deprecated API usage"));
