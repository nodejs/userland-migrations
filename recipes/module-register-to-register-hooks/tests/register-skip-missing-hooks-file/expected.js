import { register } from "node:module";

register("./does-not-exist.mjs", import.meta.url);
