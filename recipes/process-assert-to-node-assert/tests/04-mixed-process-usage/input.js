import process from "node:process";
process.assert(value, "Process assertion");
process.env.NODE_ENV = "test";
console.log(process.pid);
