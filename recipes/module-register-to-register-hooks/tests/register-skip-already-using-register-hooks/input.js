import { register, registerHooks } from "node:module";

registerHooks({ resolve: (specifier, context, next) => next(specifier, context) });
register("./hooks.mjs", import.meta.url);
