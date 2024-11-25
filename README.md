# Node.js userland migrations

This repository contains codemodes (automated migrations) for "userland" code. These are intended to facilitate adopting new features and upgrading source-code affected by breaking changes.

[![Formatted with Biome](https://img.shields.io/badge/Formatted_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev/) [![Linted with Biome](https://img.shields.io/badge/Linted_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev) [![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)

## Usage

> [!CAUTION]
> These scripts change source code. Commit any unsaved changes before running them. Failing to do so may ruin your day.

To run the transform scripts use [`codemod`](https://go.codemod.com/github) command below:

```console
$ npx codemod <transform> --target <path> [...options]
```

* `transform` - name of transform. see available transforms below.
* `path` - directory to transform. defaults to the current directory.

See the [codemod CLI doc](https://go.codemod.com/cli-docs) for a full list of available commands.

## Available codemods

All Node.js codemods are also available in the [Codemod Registry](https://codemod.link/nodejs-official).
