import module from "node:module";

module.register("./a.mjs", import.meta.url);
module.register("./b.mjs", import.meta.url);
