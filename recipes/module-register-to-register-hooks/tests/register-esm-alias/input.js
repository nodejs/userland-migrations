import { register as registerLoader } from "node:module";

registerLoader("./hooks.mjs", import.meta.url);
