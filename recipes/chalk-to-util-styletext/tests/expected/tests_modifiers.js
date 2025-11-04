import { styleText } from "node:util";

console.log(styleText(["bold", "italic", "underline"], "Important announcement"));
console.log(styleText(["dim", "strikethrough"], "Deprecated feature"));
console.log(styleText("inverse", "Inverted colors"));
