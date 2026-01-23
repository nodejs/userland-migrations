import { styleText } from "node:util";

console.error(styleText("red", "Error message", { stream: process.stderr }));

// Chained usage
console.error(styleText(["red", "bold"], "Critical error", { stream: process.stderr }));

// Multiple chained styles
console.error(styleText(["red", "bold", "underline"], "Very important error", { stream: process.stderr }));
