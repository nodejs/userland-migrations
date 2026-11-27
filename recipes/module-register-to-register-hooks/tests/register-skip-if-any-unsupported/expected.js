import { register } from "node:module";

register("./a.mjs", import.meta.url);
register("./b.mjs", import.meta.url, { data: 1 });
