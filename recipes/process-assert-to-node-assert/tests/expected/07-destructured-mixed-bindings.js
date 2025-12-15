import assert from "node:assert";
import { env } from "node:process";
assert(value, "Using destructured assert");
console.log(env.NODE_ENV);
