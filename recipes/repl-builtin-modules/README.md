# `repl.builtinModules` DEP0191

This recipe provides a guide for migrating from the deprecated `repl.builtinModules` & `repl._builtinLibs` to the new `module.builtinModules` property in Node.js.

See [DEP0191](https://nodejs.org/api/deprecations.html#DEP0191) and [DEP0142](https://nodejs.org/api/deprecations.html#DEP0142)

## Examples

```diff
- import repl from 'node:repl';
+ import module from 'node:module';

- console.log(repl.builtinModules);
+ console.log(module.builtinModules);
- console.log(repl._builtinLibs);
+ console.log(module.builtinModules);
`````
