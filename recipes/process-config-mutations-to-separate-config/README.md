# DEP0150: `process.config` is now immutable

Since Node.js v19, `process.config` is read-only. Any mutation throws at runtime.
This recipe finds mutations and either rewrites them safely or comments them out
with a hint to use a separate configuration object.

See [DEP0150](https://nodejs.org/api/deprecations.html#DEP0150).

## Examples

Direct assignment is commented out with guidance:

```diff

- process.config.target_defaults = { cflags: [] };

* // process.config is now immutable and cannot be modified (DEP0150)
* // Use a separate configuration object for custom values
* // process.config.target_defaults = { cflags: [] };
```

`Object.assign` whose result is captured is rewritten in place, copying into a
fresh object instead of mutating `process.config`:

```diff

- const config = Object.assign(process.config, { custom: "settings" });

* const config = Object.assign({}, process.config, { custom: "settings" });
```

Reading `process.config` is preserved unchanged.

## Limitations

Nested writes such as `console.log(process.config.foo = "bar")` are intentionally
left untouched: rewriting them as line comments would create invalid JS, while
the runtime error in Node.js v19+ already pinpoints the issue.
