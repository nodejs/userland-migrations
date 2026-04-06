# Writing a README for a Recipe

Every recipe directory must have a `README.md` that explains what the codemod does, how to run it, and what the transformation looks like. This document describes the required structure, section-by-section writing guidance, and the conventions used across the repository.

## The mandatory template

````markdown
---
authors: github-username
---

# TITLE HERE

One-paragraph description of what the codemod does and why.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/<recipe-directory-name>
```

## Examples

### Example 1

Brief label for what case this example covers.

```diff
-before
+after
```

## Notes

Any behavioral nuances or things the reader should know that do not fit the description.

### Limitations

Anything the codemod cannot or does not handle.
````

The `Notes` and `Limitations` sections are optional. Omit them when they would be empty. The rest of the template is mandatory.

---

## Frontmatter

Every README must open with a YAML frontmatter block:

```yaml
---
authors: github-username
---
```

**`authors` must be a GitHub username, not a display name.** The field maps to a GitHub account so that attribution is linkable and unambiguous.

- Correct: `authors: AugustinMauroy`
- Incorrect: `authors: Augustin Mauroy`

When a recipe has multiple authors, use a YAML sequence:

```yaml
---
authors:
  - github-username-one
  - github-username-two
---
```

---

## Title

The title (`# ...`) follows the frontmatter block immediately.

### Naming conventions

Three patterns are used in the repository, depending on the nature of the migration:

**1. `DEPXXXX: old-api  new-api` - for single-deprecation replacements**

Use this form when the recipe addresses one deprecation notice and the old and new names are short enough to fit on one line.

```markdown
# DEP0147: fs.rmdir() fs.rm()

# DEP0178: dirent.path dirent.parentPath

# DEP0093: crypto.fips crypto.getFips() / crypto.setFips()
```

**2. `DEPXXXX: Description` - for deprecations where the replacement is not a simple rename**

Use this form when the new API is not a direct drop-in or when listing all affected symbols inline would make the title too long.

```markdown
# DEP0185: Instantiating node:repl Classes Without new

# DEP0191: repl.builtinModules / repl.\_builtinLibs module.builtinModules
```

When multiple deprecation numbers apply, separate them with `/`:

```markdown
# DEP0095/DEP0096/DEP0126/DEP0127: Deprecated node:timers APIs
```

**3. Plain descriptive title - for non-deprecation migrations**

When the recipe does not correspond to a numbered deprecation, use a plain descriptive title.

```markdown
# Correct TypeScript Specifiers

# Import Assertions to Attributes
```

### General title rules

- Use backticks around API names and code tokens in the title.
- Keep the title to one line.

---

## Description paragraph

Immediately after the title, write a single paragraph (no heading) that describes:

1. What the deprecated API is and the deprecation number, if applicable.
2. What it is replaced with.
3. Any notable variant handling (e.g., destructured imports, ESM, synchronous counterparts).

Link to the upstream deprecation notice when one exists:

```markdown
See [DEP0147](https://nodejs.org/api/deprecations.html#DEP0147).
```

If the recipe covers multiple deprecations, link each one or group them in a sentence.

**Examples of well-written description paragraphs:**

The `rmdir` recipe describes its scope precisely:

> Converts `fs.rmdir(path, { recursive: true })` calls to `fs.rm(path, { recursive: true, force: true })`. Also handles the synchronous variant (`fs.rmdirSync` → `fs.rmSync`), the promises variant (`fs.promises.rmdir` → `fs.promises.rm`), destructured imports, and aliased imports. The `force: true` option is always added alongside `recursive: true`.

The `repl-classes-with-new` recipe names the affected classes and the import styles it handles:

> Adds the missing `new` keyword to calls to `repl.REPLServer()` and `repl.Recoverable()` that are invoked as plain functions. Works with CommonJS `require`, ESM named imports, ESM namespace imports, and dynamic imports.

---

## Usage section

The `Usage` section gives the single command a reader needs to run the codemod. Use this exact structure:

````markdown
## Usage

Run this codemod with:

```sh
npx codemod @nodejs/<recipe-directory-name>
```
````

The package name is `@nodejs/` followed by the recipe's directory name as it appears under `recipes/`. For example, the recipe in `recipes/rmdir/` is run with:

```sh
npx codemod @nodejs/rmdir
```

If the codemod requires special flags or environment variables, document them here. See `recipes/correct-ts-specifiers/README.md` for an example of a recipe that requires `NODE_OPTIONS` to be set, along with guidance for running inside monorepos.

---

## Examples section

The `Examples` section is the most important part of the README. It shows exactly what the transformation does by deriving examples directly from the test fixtures in `tests/input/` and `tests/expected/`.

### How to derive examples from test fixtures

Each recipe has input fixtures in `tests/input/` and expected-output fixtures in `tests/expected/`. Read those files and construct `diff` blocks by diffing them line by line. Lines that are removed carry a `-` prefix; lines that are added carry a `+` prefix; lines that are unchanged and provide useful context carry a leading space.

For example, `tests/input/file-1.js` for the `rmdir` recipe contains:

```js
const fs = require("node:fs");

const pathName = "path/to/directory";

fs.rmdir(pathName, { recursive: true }, () => {});
fs.rmdirSync(pathName, { recursive: true });
fs.promises.rmdir(pathName, { recursive: true });
fs.rmdir(pathName, { recursive: false }); // should not be transformed
fs.rmdir(pathName); // should not be transformed
```

The corresponding `tests/expected/file-1.js` contains:

```js
const fs = require("node:fs");

const pathName = "path/to/directory";

fs.rm(pathName, { recursive: true, force: true }, () => {});
fs.rmSync(pathName, { recursive: true, force: true });
fs.promises.rm(pathName, { recursive: true, force: true });
fs.rmdir(pathName, { recursive: false }); // should not be transformed
fs.rmdir(pathName); // should not be transformed
```

This pair becomes the `diff` block shown in Example 1 of the `rmdir` README.

### Formatting diff blocks

Always use a fenced code block with the `diff` language tag:

````markdown
```diff
-fs.rmdir(pathName, { recursive: true }, () => { });
+fs.rm(pathName, { recursive: true, force: true }, () => { });
```
````

Unchanged lines that provide essential context (such as the `require` statement or surrounding code) can be included without a prefix character. Omit lines that are not relevant to the transformation being illustrated. Do not pad with large blocks of unchanged code.

### Subsections for multiple transforms

When a recipe handles multiple distinct transformations, give each one its own `###` subsection with a short label that says what case it covers. Name subsections by the import style or the specific API variant, not by a generic "Case 1/2/3" numbering where a descriptive label is possible.

**Good subsection names:**

- `### Namespace require - all three API shapes are migrated`
- `### Destructured require`
- `### Aliased ESM import`
- `### Reading crypto.fips becomes crypto.getFips()`

**Example of subsection structure:**

````markdown
## Examples

### Example 1

Namespace `require` - all three API shapes are migrated, untouched calls are left alone:

```diff
 const fs = require("node:fs");
-fs.rmdir(pathName, { recursive: true }, () => { });
+fs.rm(pathName, { recursive: true, force: true }, () => { });
```

### Example 2

Destructured `require` - `rm` is added to the destructured bindings and calls are updated:

```diff
-const { rmdir, rmdirSync } = require("node:fs");
+const { rm, rmdir, rmSync } = require("node:fs");
```
````

When a recipe makes a single, uniform transformation across all import styles, a single `diff` block without subsections is fine. See `recipes/util-extend-to-object-assign/README.md` for an example.

When the set of changes is better expressed as a table than as code (for example, a codemod that replaces many individual method names), a Markdown table is acceptable. See `recipes/util-is/README.md` for an example.

### How many examples to include

Include one example per meaningfully distinct case the codemod handles. At minimum, show one example. Show more when:

- The recipe handles both CJS and ESM import styles differently.
- The recipe handles destructured bindings separately from namespace imports.
- The recipe has edge cases that are explicitly not transformed.

Do not duplicate examples that differ only in whitespace or variable names.

---

## Notes section

The `Notes` section (heading `## Notes`) is for information that does not fit the description paragraph but is important for a reader running the codemod. Examples:

- The codemod reads `package.json` to determine module type and adjusts the output accordingly.
- Internal bookkeeping fields used by the deprecated API have no public equivalent and must be reviewed manually.
- The migration is one-and-done - the output should be committed and not re-run.

**Omit `## Notes` entirely when there is nothing to say.** Do not include an empty section or a placeholder like "N/A".

A `### Limitations` subsection may be nested under `## Notes` when the limitations are closely related to a noted behavior:

```markdown
## Notes

### Limitations

Only calls that include `{ recursive: true }` in the options argument are transformed.
Calls to `fs.rmdir` without that option are left untouched, as they do not trigger the deprecation.
```

---

## Limitations section

The `Limitations` section (heading `## Limitations`, or `### Limitations` nested under `## Notes`) documents what the codemod explicitly does not handle. Examples:

- The codemod cannot determine algorithm-specific key or IV sizes; the reader must review and adjust the generated scaffolding.
- `url.resolve` has no direct equivalent in the WHATWG URL API; the reader must implement custom logic.
- Cases where the input is too dynamic to analyze statically are skipped and logged.

**Omit `## Limitations` entirely when there is nothing to say.**

A `## Caveats` heading is also acceptable and used in some recipes as an equivalent to `## Limitations`. Use either consistently; do not use both in the same file.

---

## Checklist for a complete README

Before opening a pull request, verify that the README:

- [ ] Opens with a `---`-delimited frontmatter block containing `authors: <github-username>`.
- [ ] Has a title that follows the naming convention for its type (DEP number + arrow, DEP number + description, or plain descriptive).
- [ ] Has a description paragraph that names the deprecated API, its replacement, and any notable variant handling.
- [ ] Has a `## Usage` section with the correct `npx codemod @nodejs/<name>` command.
- [ ] Has a `## Examples` section with at least one `diff` block derived from the test fixtures.
- [ ] Uses `###` subsections in `## Examples` when there are multiple distinct transforms.
- [ ] Includes `## Notes` and/or `## Limitations` only when there is substantive content to put in them.
- [ ] Does not have any empty sections.
