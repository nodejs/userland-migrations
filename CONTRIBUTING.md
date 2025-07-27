# Contributing

Thank you for your interest in contributing to this project! We welcome contributions from the community. Please follow these guidelines to ensure a smooth contribution process.

## Prerequisites

- Node.js (specifie the version in the `.nvmrc` file)
- npm for managing packages

## Project Structure

The project is structured as follows:

- `recipes/`: is where the codemod are stored.
- `utils`: is a npm workspace that contains utility functions used by the codemods like `ast-grep` utilities.

### A codemod structure

Each codemod is defined in a directory under `recipes/`. The directory should contain:

- `README.md` - A description of the codemod, its purpose, and how to use it.
- `package.json` - The package manifest for the codemod.
- `src/workflow.ts` - The main entry point for the codemod. That uses `jssg` codemod API to define the transformation logic. [codemod docs](https://docs.codemod.com/cli/cli-reference#codemod%40next-jssg)
- `codemod.yml` -  The codemod manifest file
- `workflow.yml` - The workflow definition file that defines the codemod's workflow. [workflow docs](https://docs.codemod.com/cli/workflows)
- `test/` - Contains tests for the codemod. Tests should be written using the `jssg` testing utilities. [codemod docs](https://docs.codemod.com/cli/cli-reference#codemod%40next-jssg)
- `tsconfig.json` - TypeScript configuration file for the codemod and your IDEs.

**`workflow.ts`** example:
```ts
import type { SgRoot, Edit } from "@ast-grep/napi";

/**
 * Transform function that converts deprecated api.fn calls
 * to the new api.fn syntax.
 *
 * Handles:
 * 1. api.fn(<args>)
 * 2. api.fn(<args>, { recursive: true })
 * ...
 */
export default function transform(root: SgRoot): string | null {
	const rootNode = root.root();
	let hasChanges = false;
	const edits: Edit[] = [];

	// do some transformation

	if (!hasChanges) return null;

	return rootNode.commitEdits(edits);
}
```

**`codemod.yml`** example:
```yaml
schema_version: "1.0"
name: "@nodejs/<codemod-name>"
version: 0.0.1
description: <Your codemod description>
author: <Your Name>
license: MIT
workflow: workflow.yaml
category: migration

targets:
  languages:
    - javascript
    - typescript

keywords:
  - transformation
  - migration

registry:
  access: public
  visibility: public
```

> [!TIPS]
> To iterate quickly with codemods, you can use their [codemod studio](https://docs.codemod.com/codemod-studio)

## Before pushing a commit

A convenient superset of checks is available via `node --run pre-commit`, which automatically fixes formatting and linting issues (that are safe to fix), checks types, and runs tests. Changes resulting from this should be committed.

> [!WARNING]
> Some integration tests modify fixtures because they run the entire codemod. Remember to use the `git restore` command to restore these files before pushing a commit.
