import { register } from "node:module";

function setup(register) {
	register("./other.mjs");
}

register("./hooks.mjs", import.meta.url);
