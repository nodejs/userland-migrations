import { styleText } from "node:util";

// These have limited terminal support - may not work in all environments
console.log(styleText("overlined", "Overlined text"));
console.log(styleText("blink", "Blinking text"));
console.log(styleText("doubleunderline", "Double underlined"));
console.log(styleText("framed", "Framed text"));
