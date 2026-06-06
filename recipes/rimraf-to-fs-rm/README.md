# Rimraf to fs.rm

This recipe migrates straightforward `rimraf` delete calls to Node.js built-in
`fs.rm`, `fs.rmSync`, and `fs/promises.rm` APIs.

It covers the literal delete cases for `rimraf` v3, v4, and v5 style imports:

- default async imports from `rimraf`, `rimraf-v3`, or `rimraf-v4`
- named `rimraf` and `rimrafSync` imports from `rimraf-v5`
- callback-based literal deletes
- promise-based literal deletes
- synchronous literal deletes
- synchronous glob deletes by expanding with `fs.globSync()` before `fs.rmSync()`
- package.json dependency removal when `rimraf` is not still used as a CLI in scripts

## Examples

```diff
- import rimraf from "rimraf-v4";
+ import { rm as rmPromise } from "node:fs/promises";

- await rimraf("dist", { glob: false });
+ await rmPromise("dist", { recursive: true, force: true });
```

```diff
- import { rimraf, rimrafSync } from "rimraf-v5";
+ import { rmSync } from "node:fs";
+ import { rm as rmPromise } from "node:fs/promises";

- await rimraf("dist");
- rimrafSync("build");
+ await rmPromise("dist", { recursive: true, force: true });
+ rmSync("build", { recursive: true, force: true });
```

```diff
- import { rimrafSync } from "rimraf-v5";
+ import { globSync, rmSync } from "node:fs";

- rimrafSync("dist/**/*.js");
+ for (const filePath of globSync("dist/**/*.js")) {
+   rmSync(filePath, { recursive: true, force: true });
+ }
```

## Manual review

Some `rimraf` behavior should stay manual because it depends on runtime
semantics rather than only source syntax:

- custom retry behavior
- custom glob options
- async glob deletes with callbacks
- package-specific fallback behavior on Windows

When code depends on those behaviors, keep the behavior explicit instead of
assuming full parity with native deletion APIs.
