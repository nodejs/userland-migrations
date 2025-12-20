const { styleText } = require("node:util");

console.error(styleText("red", "Error from stderr", { stream: process.stderr }));
console.error(styleText(["yellow", "bold"], "Warning from stderr", { stream: process.stderr }));
