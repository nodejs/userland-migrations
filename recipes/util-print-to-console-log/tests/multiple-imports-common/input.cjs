const { print, inspect } = require("node:util");

print("Starting application");
const formatted = inspect({ foo: "bar" });
console.log(formatted);
