const { styleText } = await import("node:util");

console.log(styleText("red", "Error"));
console.log(styleText(["bold", "cyan"], "Info"));
