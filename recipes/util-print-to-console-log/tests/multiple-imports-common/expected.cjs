const { inspect } = require("node:util");

console.log("Starting application");
const formatted = inspect({ foo: "bar" });
console.log(formatted);
