<img
  src="https://raw.githubusercontent.com/nodejs/userland-migrations/main/.github/assets/Userland-Migration-Tagline.png"
  alt="Node.js Userland Migrations"
/>

This repository contains codemods (automated migrations) for "userland" code. These are intended to facilitate adopting new features and upgrading source-code affected by breaking changes.

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

You can find official Node.js codemods in the [Codemod Registry](https://codemod.com/registry?author=nodejs). Additionally, community-contributed Node.js codemods are available in the [Codemod Registry](https://codemod.link/nodejs-official).

## Acknowledgments

We would like to extend our gratitude to the team at Codemod for providing their excellent tools and for their direct assistance with the Node.js project. Their support has been invaluable in making these migrations possible.
