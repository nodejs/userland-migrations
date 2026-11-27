---
authors: FrustratedBoy420
---

# DEP0094: `assert.fail()` with more than one argument

Rewrites `assert.fail()` calls that pass more than one argument into `throw new AssertionError({ ... })`, so the thrown error keeps its `actual`, `expected` and `operator` values.

Node.js 25 removed this signature: [DEP0094](https://nodejs.org/api/deprecations.html#DEP0094). It does not throw a different error. It ignores the extra arguments and uses the first one as the message, so `assert.fail(1, 2, 'values differ')` throws an error with the message `1` and no `actual` or `expected`.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/assert-fail-to-assertion-error
```

## Examples

### Example 1

Two arguments: the old `assert.fail()` used the `'!='` operator and generated the message `1 != 2`, which `AssertionError` produces from the same values.

```diff
 const assert = require('node:assert');

-assert.fail(1, 2);
+throw new assert.AssertionError({ actual: 1, expected: 2, operator: '!=' });
```

### Example 2

Three or more arguments: the operator defaults to `'fail'`, as before, and `stackStartFn` is kept.

```diff
 import * as assert from 'node:assert';

-assert.fail(actual, expected, 'values differ');
-assert.fail(actual, expected, undefined, '>', check);
+throw new assert.AssertionError({ actual: actual, expected: expected, message: 'values differ', operator: 'fail' });
+throw new assert.AssertionError({ actual: actual, expected: expected, operator: '>', stackStartFn: check });
```

### Example 3

A named `fail` import gets an `AssertionError` binding next to it.

```diff
-import { fail } from 'node:assert';
+import { fail, AssertionError } from 'node:assert';

-fail(a, b);
+throw new AssertionError({ actual: a, expected: b, operator: '!=' });
```

## Notes

- `assert.fail()` and `assert.fail(message)` are still supported and are not changed.
- `node:assert`, `assert`, `node:assert/strict` and `assert/strict` are handled, with `require`, default, namespace and named imports, including aliases.

### Limitations

These calls are left unchanged and reported with `console.warn`, with their file and position, so you can migrate them by hand:

- The `message` or `operator` argument is not a string literal, a template literal without substitutions, or `undefined`. The old `assert.fail()` threw `message` itself when it was an `Error`, and a static rewrite cannot know that.
- The call is part of a larger expression, such as `ok || assert.fail(a, b)` or `() => assert.fail(a, b)`, because `throw` is a statement.
- The arguments use spread syntax, such as `assert.fail(...args)`.

<!-- sync_to_learn: false -->
