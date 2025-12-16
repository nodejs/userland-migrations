import assert from "node:assert";
import process from "node:process";
assert(value, "Process assertion");
process.env.NODE_ENV = "test";
console.log(process.pid);
