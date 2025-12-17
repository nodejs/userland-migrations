<img
  src="https://raw.githubusercontent.com/nodejs/userland-migrations/main/.github/assets/Userland-Migration-Tagline.png"
  alt="Node.js Userland Migrations"
/>

This repository contains codemods (automated migrations) for "userland" code. These are intended to facilitate adopting new features and upgrading source-code affected by breaking changes.

## Usage

> [!CAUTION]
> These scripts change source code. Commit any unsaved changes before running them. Failing to do so may ruin your day.

To run the transform scripts use [`codemod`](https://go.codemod.com/github) command below:

### From registry

With the codemod CLI you can run a workflow from the [Codemod Registry](https://codemod.link/nodejs-official). Replace `<recipe>` with the name of the recipe you want to run:

```bash
npx codemod @nodejs/<recipe>
```

### From source

With the codemod CLI you can run a workflow from a local file. First, clone this repository, then run the command below from your project directory:

```bash
git clone https://github.com/nodejs/userland-migrations.git
cd /path/to/your-project
npx codemod workflow run -w /path/to/folder/userland-migrations/recipes/<recipe>/workflow.yaml
```

See the [codemod CLI doc](https://go.codemod.com/cli-docs) for a full list of available commands.

## Available codemods

You can find official Node.js codemods in the [Codemod Registry](https://codemod.link/nodejs-official).

## Acknowledgments

We would like to extend our gratitude to the team at Codemod for providing their excellent tools and for their direct assistance with the Node.js project. Their support has been invaluable in making these migrations possible.
