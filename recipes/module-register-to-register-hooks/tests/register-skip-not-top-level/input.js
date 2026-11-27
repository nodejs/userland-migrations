import { register } from "node:module";

if (process.env.DEBUG) {
	register("./hooks.mjs", import.meta.url);
}
