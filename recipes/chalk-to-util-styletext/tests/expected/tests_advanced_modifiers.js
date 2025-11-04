import { styleText } from "node:util";

// Some of these have limited terminal support - may not work in all environments
console.log(styleText("bold", "Bold text"));
console.log(styleText("blink", "Blinking text"));
console.log(styleText("dim", "Dimmed text"));
console.log(styleText("doubleunderline", "Double underlined"));
console.log(styleText("framed", "Framed text"));
console.log(styleText("italic", "Italic text"));
console.log(styleText("inverse", "Inverted colors"));
console.log(styleText("hidden", "Hidden text"));
console.log(styleText("overlined", "Overlined text"));
console.log(styleText("reset", "Reset text"));
console.log(styleText("strikethrough", "Strikethrough text"));
console.log(styleText("underline", "Underlined text"));
