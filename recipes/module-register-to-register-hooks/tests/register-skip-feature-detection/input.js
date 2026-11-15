import module from "node:module";

if (module.register) {
	module.register("./hooks.mjs", import.meta.url);
}
