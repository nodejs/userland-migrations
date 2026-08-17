const { styleText } = await import("node:util");

console.log(styleText("red", "Error message"));
console.log(styleText("green", "Success message"));
