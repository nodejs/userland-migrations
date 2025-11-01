import assert from "node:assert";
import { env } from "node:process";
assert(value, "Using aliased assert");
assert.strictEqual(a, b);
console.log(env.NODE_ENV);
