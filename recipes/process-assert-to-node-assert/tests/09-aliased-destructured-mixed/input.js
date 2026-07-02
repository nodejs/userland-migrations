import { assert as nodeAssert, env } from "node:process";
nodeAssert(value, "Using aliased assert");
nodeAssert.strictEqual(a, b);
console.log(env.NODE_ENV);
