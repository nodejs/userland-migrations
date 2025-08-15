const { inspect } = require("node:util");

console.log(new Date().toLocaleString(), "Starting application");
const formatted = inspect({ foo: "bar" });
console.log(formatted);
