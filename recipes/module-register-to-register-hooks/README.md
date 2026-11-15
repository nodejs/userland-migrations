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

- **Run it on the whole project.** The codemod migrates two kinds of files, `register()` call sites and hooks modules, and a call site is only converted if the hooks file it points to can be converted too. Running on both together (the default) keeps them in step. If you run it on the call site alone, the hooks file stays asynchronous and `registerHooks()` will reject it.
- **Hooks files are read.** For each `register()` call the codemod reads the file it points at and applies the same checks as it does to a hooks module. The file must exist and must be a relative path or a `file:` URL: a package name cannot be inspected, so those registrations are left alone.
- **How hooks are recognised.** A file is treated as a hooks module only if it exports `resolve` and/or `load` functions that call their third argument (`nextResolve` / `nextLoad`). Other exports named `load` or `resolve` are never touched.
- **Same thread, same order.** Registered hooks now run on the main thread, and the hooks module is loaded before the code that follows `registerHooks()`. The hooks module's own dependencies are not affected by its own hooks, the same as before.
- **Node.js versions.** `registerHooks()` is available from Node.js 22.15.0 and 23.5.0. Code that still has to run on older versions needs a version check, and the codemod does not add one.
- **CommonJS.** In CommonJS files the hooks module is loaded with `require()`: an ES module hooks file must not use top-level `await`, and your Node.js version must support `require(esm)`. In ES modules, a CommonJS hooks file is imported by its default export, because Node.js can only see some named exports of a CommonJS module.
- **Launch flags.** The codemod does not change how Node.js is launched. If you use `--experimental-loader` or `--loader` (also removed by DEP0205), move the registration into a file that calls `registerHooks()` and load it with `--import` or `--require`.

### Limitations

The codemod leaves a file as it is, and says nothing, when it cannot be sure the result behaves the same. Migrate those by hand:

- **State and data.** `register()` is passed `data` or `transferList`, or the hooks module exports `initialize()` or `globalPreload()`. `registerHooks()` has no equivalent: hooks run in the application thread, so they can share state directly.
- **Real asynchronous work.** A hook does asynchronous work other than awaiting `nextResolve()` or `nextLoad()`: reading a file with `fs/promises`, calling `fetch()`, awaiting or returning the result of an async helper, or using `.then()` / `.catch()`. `registerHooks()` hooks must be synchronous. Use the synchronous equivalents (`readFileSync()`), or, if the work cannot be made synchronous, keep the asynchronous hooks off-thread with [`module-register-ponyfill`](https://github.com/joyeecheung/module-register-ponyfill) or [`everysync`](https://github.com/mcollina/everysync).
- **Imported helpers.** A hook calls a function imported from another file or package. The codemod cannot tell whether it returns a promise. Built-in modules other than `*/promises` are fine.
- **Types.** A hook is annotated as returning a `Promise`. Remove the annotation (and the `Promise` in the `next` parameter type) and run the codemod again.
- **Dynamic registrations.** The specifier is not a string literal (or `new URL("…", import.meta.url)`), the parent URL is not the current file, the result of `register()` is used, the call is not at the top level of an ES module, or it is feature-detected (`module.register?.()`, `if (module.register)`). If a file has more than one `register()` call and any of them cannot be converted, none are.
- **Hooks shapes.** A hooks module exports its hooks through a pattern other than a direct `export`, `export { … }`, `exports.x =`, or `module.exports = { … }`, or passes `nextResolve` / `nextLoad` around instead of calling it directly.
- **Worker threads.** Hooks registered with `register()` also applied to worker threads, and hooks registered with `registerHooks()` do not. The codemod cannot see whether your application relies on that, so check applications that create `Worker`s.
