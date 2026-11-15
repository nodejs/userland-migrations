import module from "node:module";

console.log(typeof module.register);
module.register("./hooks.mjs", import.meta.url);
