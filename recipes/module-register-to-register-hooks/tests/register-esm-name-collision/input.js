import { register } from "node:module";
import { hooks } from "./elsewhere.mjs";

register("./hooks.mjs", import.meta.url);
console.log(hooks);
