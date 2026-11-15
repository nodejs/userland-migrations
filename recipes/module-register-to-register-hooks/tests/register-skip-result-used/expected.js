import { register } from "node:module";

const result = register("./hooks.mjs", import.meta.url);
console.log(result);
