import { register } from "node:module";

// "hooks.mjs" is a bare specifier (a package), not the file next to this one.
register("hooks.mjs", import.meta.url);
