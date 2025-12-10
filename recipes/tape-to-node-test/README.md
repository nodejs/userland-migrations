# Tape to Node.js Test Runner Codemod

This codemod migrates tests written using `tape` to the native Node.js test runner (`node:test`).

## Features

- Replaces `tape` imports with `node:test` and `node:assert/strict`.
- Converts `test(name, (t) => ...)` to `test(name, async (t) => ...)`.
- Maps `tape` assertions to `node:assert` equivalents.
- Handles `t.plan` (by commenting it out).
- Handles `t.end` (removes it for async tests, converts to `done` callback for callback-style tests).
- Handles `t.test` subtests (adds `await`).
- Converts `t.teardown` to `t.after`.

## Usage

```bash
npx codemod @nodejs/tape-to-node-test
```
