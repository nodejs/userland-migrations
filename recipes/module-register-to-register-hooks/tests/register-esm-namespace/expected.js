import module from "node:module";
import * as a from "./a.mjs";
import * as b from "./b.mjs";

module.registerHooks(a);
module.registerHooks(b);
