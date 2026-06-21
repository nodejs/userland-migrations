import { styleText } from "node:util";

console.log(styleText(["bold", "red"], "Failure"));
console.log(styleText(["bold", "italic", "red"], "Failure"));
console.log(styleText(["bold", "italic", "underline", "red"], "Failure"));

const errorStyle = (msg) => styleText(["bold", "red"], msg);
const badge = styleText(["bgRed", "white"], " ERROR ");
