import { registerHooks } from "node:module";
import { hooks } from "./elsewhere.mjs";
import * as hooks2 from "./hooks.mjs";

registerHooks(hooks2);
console.log(hooks);
