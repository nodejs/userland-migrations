const { log, inspect } = require("node:util");

log("Starting application");
const formatted = inspect({ foo: "bar" });
console.log(formatted);
