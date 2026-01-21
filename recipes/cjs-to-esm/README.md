
# ESM Migration Codemod

## Context-local Variable Migration

This codemod includes a step to help migrate context-local variables and Node.js built-in globals from CommonJS to ESM. It detects usages of:

- `__filename` → `import.meta.filename` (Node.js v20.11.0 / v21.2.0)
- `__dirname` → `import.meta.dirname` (Node.js v20.11.0 / v21.2.0)
- `require.main` → `import.meta.main` (Node.js v22.18.0 / v24.2.0)
- `require.resolve` → `import.meta.resolve` (available)

If these or other context-local patterns are found, the codemod will emit a warning and suggest reviewing the [migration guide](https://github.com/nodejs/package-examples/blob/main/guide/05-cjs-esm-migration/migrating-context-local-variables/README.md).

**Note:** Some features require specific Node.js versions as indicated above.
