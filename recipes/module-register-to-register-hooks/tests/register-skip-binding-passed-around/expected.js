import { register } from "node:module";

setup(register);
register("./hooks.mjs", import.meta.url);
