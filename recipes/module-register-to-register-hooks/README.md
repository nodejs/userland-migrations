---
authors: GeoffreyBooth
---

# DEP0205: `module.register()` to `module.registerHooks()`

Migrates asynchronous module customization hooks to the synchronous, in-thread [`module.registerHooks()`](https://nodejs.org/api/module.html#moduleregisterhooksoptions) API, as required by [DEP0205](https://nodejs.org/api/deprecations.html#DEP0205). The codemod converts `register()` calls that point at a hooks module (ES module and CommonJS, named, aliased, and namespace imports) and rewrites `resolve` and `load` hooks whose only asynchronous work is awaiting `nextResolve()` or `nextLoad()`.

The codemod is conservative. A file is rewritten only when the result is certain to behave the same, and every other file is left exactly as it was. Hooks that do real asynchronous work, use `initialize`, or receive `data` must be migrated by hand; see [Limitations](#limitations).

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/module-register-to-register-hooks
```

## Examples

### Example 1

An ES module that registers a hooks file:

```diff
-import { register } from "node:module";
+import { registerHooks } from "node:module";
+import * as hooks from "./hooks.mjs";

-register("./hooks.mjs", import.meta.url);
+registerHooks(hooks);
```

### Example 2

A CommonJS file, with a renamed binding:

```diff
-const { register: addHooks } = require("node:module");
+const { registerHooks: addHooks } = require("node:module");
 const { pathToFileURL } = require("node:url");

-addHooks("./hooks.cjs", pathToFileURL(__filename).href);
+addHooks(require("./hooks.cjs"));
```

### Example 3

The hooks themselves: `async` is dropped, and so is `await` on the `next*` functions, which are synchronous in `registerHooks()`:

```diff
-export async function resolve(specifier, context, nextResolve) {
+export function resolve(specifier, context, nextResolve) {
   if (specifier === "virtual:answer") {
     return { url: "virtual:answer", shortCircuit: true };
   }

-  return await nextResolve(specifier, context);
+  return nextResolve(specifier, context);
 }

-export async function load(url, context, nextLoad) {
-  const result = await nextLoad(url, context);
+export function load(url, context, nextLoad) {
+  const result = nextLoad(url, context);

   return result;
 }
```

## Notes

- `register()` calls and hooks modules are migrated independently, so the codemod works whether you run it on a whole project or on a single file.
- Registered hooks now run on the same thread as the application, so the hooks file is loaded before the code that follows the `registerHooks()` call. The hooks module's own dependencies are not affected by its own hooks, the same as before.
- In CommonJS files the hooks module is loaded with `require()`. If the hooks file is an ES module, it must not use top-level `await`, and your Node.js version must support `require(esm)`.
- The codemod does not change how Node.js is launched. If you use `--experimental-loader` or `--loader` (also removed by DEP0205), move the registration into a file that calls `registerHooks()` and load it with `--import` or `--require`.

### Limitations

The codemod skips a file, and logs nothing, in these cases. Migrate them by hand:

- `register()` is passed `data` or `transferList`, or the hooks module exports `initialize()` or `globalPreload()`. `registerHooks()` has no equivalent: hooks run in the application thread, so they can share state directly.
- A hook does asynchronous work other than awaiting `nextResolve()` or `nextLoad()`, for example reading a file with `fs/promises`, calling `fetch()`, or awaiting a helper. `registerHooks()` hooks must be synchronous: use the synchronous equivalents (`readFileSync()`), or, if the work cannot be made synchronous, use [`module-register-ponyfill`](https://github.com/joyeecheung/module-register-ponyfill) or [`everysync`](https://github.com/mcollina/everysync) to keep the asynchronous hooks off-thread.
- The specifier passed to `register()` is not a string literal (or `new URL("…", import.meta.url)`), the parent URL is not the current file, or the call is not at the top level of an ES module.
- A file contains more than one `register()` call and at least one of them cannot be converted: none of that file's calls are changed.
- A hooks module exports its hooks through a pattern other than a direct `export`, `export { … }`, `exports.x =`, or `module.exports = { … }`.
- Hooks that pass `nextResolve` or `nextLoad` around instead of calling it directly.
