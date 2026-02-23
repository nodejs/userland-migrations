# Jest to Node Test

This package transforms Jest test files into `node:test` files.

This is a one-and-done process, and the updated source-code should be committed to your version control (eg git); thereafter, source-code import statements should be authored compliant with the ECMAScript (JavaScript) standard.

## TODO:

- Remove `jest`, `@types/jest`, `@jest/globals` and related modules from `package.json`
- Check/install `expect`
- Update `package.json` scripts that use `jest`
- remove `jest` config files
- remove `jest` config from `package.json` and `tsconfig.json`
- Migrate snapshots ✅
- Convert mocks ✅
- Convert setup/teardown files
- Migrate assertions
- Migrate test/it config (e.g. timeout)
- Migrate suite methods (e.g. `it.each`)
- Check non-TS CJS/ESM support
