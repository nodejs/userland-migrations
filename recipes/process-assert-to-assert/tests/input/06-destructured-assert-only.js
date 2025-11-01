import { assert } from "node:process";
assert(condition, "Assertion from destructured import");
assert.throws(() => { throw new Error("test"); });
