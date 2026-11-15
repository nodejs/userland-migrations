import { register } from "node:module";

register(process.env.HOOKS, import.meta.url);
