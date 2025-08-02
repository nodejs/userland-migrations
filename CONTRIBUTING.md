# Contributing to Node.js Userland Migration

Thank you for your interest in contributing to this project! We value contributions from the community and want to make the process as smooth as possible.

## Getting Started

### Prerequisites

Before you begin, ensure you have the current versions of the following installed:

- node
- npm

### Project Overview

Our codebase is organized as follows:

- `.github/`: Contains GitHub files like issue templates and workflows
- `recipes/`: Contains all the codemods
- `utils/`: An npm workspace with utility functions used by the codemods (including [ast-grep](https://ast-grep.github.io/) utilities)

## Codemod Development

### Structure of a Codemod

Each codemod resides in its own directory under `recipes/` and should include:

| File | Purpose |
|------|---------|
| `README.md` | Description, purpose, and usage instructions |
| `package.json` | Package manifest |
| `src/workflow.ts` | Main entry point using the `jssg` codemod API |
| `codemod.yml` | Codemod manifest file |
| `workflow.yml` | Workflow definition file |
| `tests/` | Test suite using `jssg` testing utilities |
| `tsconfig.json` | TypeScript configuration |

### Example Files

**`src/workflow.ts` example:**
```ts
import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
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

**`codemod.yml` example:**
```yaml
schema_version: "1.0"
name: "@nodejs/<codemod-name>"
version: 1.0.0
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

## Useful Resources

- [Codemod CLI Reference](https://docs.codemod.com/cli/cli-reference)
- [Codemod Workflow Documentation](https://docs.codemod.com/cli/workflows)
- [Codemod Studio Documentation](https://docs.codemod.com/codemod-studio)
- [JSSG API Reference](https://docs.codemod.com/cli/cli-reference#cli-command-reference)
- [AST-grep Documentation](https://ast-grep.github.io/)

## Development Workflow

### Before Pushing a Commit

Run our comprehensive check suite:

```bash
node --run pre-commit
```

This will:
- Fix formatting and safe linting issues automatically
- Check types
- Run tests
Be sure to commit any changes resulting from these automated fixes.

> [!WARNING]
> Some integration tests modify fixtures as they run the entire codemod. Remember to use `git restore` to revert these files before committing.

### Commit Messages

Please follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for your commit messages. This helps with:

- Automatic changelog generation
- Understanding the history of changes
- Semantic versioning

Format:
```
<type>(<scope>): <description>
```

- **`type`**: The type of change (e.g., `feat`, `fix`, `docs`, `chore`, etc.)
- **`scope`**: A short, lowercase description of the section of the codebase affected (e.g., `tmpDir-to-tmpdir`, `esm-migration`)
- **`description`**: A concise summary of the change

Examples:
- `feat(tmpDir-to-tmpdir): add new node.js 18 migration codemod`
- `fix(esm-migration): correct type checking in ESM migration`
- `docs(codemod-usage): improve usage examples`

## Pull Request Process

When submitting a pull request:
1. Ensure your changes are well-documented
2. Run all tests (`node --run pre-commit`)
3. Follow the project's coding standards
4. Use the [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/) format in your PR title and description
5. Link to any related issues, using [GitHub keywords](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/using-keywords-in-issues-and-pull-requests) where applicable.

### Acceptance Criteria

For a pull request to be merged, it must:
- Receive approval from at least 2 reviewers
- Pass all tests
- Be open for at least 48 hours to allow for review and discussion
  - except hotfixes and trivial corrections (like typos)

### Developer's Certificate of Origin 1.1

```
By contributing to this project, I certify that:

- (a) The contribution was created in whole or in part by me and I have the right to
  submit it under the open source license indicated in the file; or
- (b) The contribution is based upon previous work that, to the best of my knowledge,
  is covered under an appropriate open source license and I have the right under that
  license to submit that work with modifications, whether created in whole or in part
  by me, under the same open source license (unless I am permitted to submit under a
  different license), as indicated in the file; or
- (c) The contribution was provided directly to me by some other person who certified
  (a), (b) or (c) and I have not modified it.
- (d) I understand and agree that this project and the contribution are public and that
  a record of the contribution (including all personal information I submit with it,
  including my sign-off) is maintained indefinitely and may be redistributed consistent
  with this project or the open source license(s) involved.

```
