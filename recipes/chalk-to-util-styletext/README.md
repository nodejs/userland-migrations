---
authors: richiemccoll
---

# chalk util.styleText

Migrates usage of the `chalk` npm package to the Node.js built-in `util.styleText()` API. Replaces the `chalk` import with `{ styleText }` from `node:util` and rewrites all chalk method calls accordingly. Chained chalk styles are converted to an array of style strings.

## Usage

Run this codemod with:

```sh
npx codemod @nodejs/chalk-to-util-styletext
```

## Examples

### Example 1

Basic color methods (ESM default import)

```diff
-import chalk from "chalk";
+import { styleText } from "node:util";

-console.log(chalk.red("Error message"));
-console.log(chalk.green("Success message"));
-console.log(chalk.blue("Info message"));
+console.log(styleText("red", "Error message"));
+console.log(styleText("green", "Success message"));
+console.log(styleText("blue", "Info message"));
```

### Example 2

Chained styles

```diff
-import chalk from "chalk";
+import { styleText } from "node:util";

-console.log(chalk.red.bold("Error: Operation failed"));
-console.log(chalk.green.underline("Success: All tests passed"));
-console.log(chalk.yellow.bgBlack("Warning: Deprecated API usage"));
+console.log(styleText(["red", "bold"], "Error: Operation failed"));
+console.log(styleText(["green", "underline"], "Success: All tests passed"));
+console.log(styleText(["yellow", "bgBlack"], "Warning: Deprecated API usage"));
```

### Example 3

CommonJS `require`

```diff
-const chalk = require("chalk");
+const { styleText } = require("node:util");

-const error = chalk.red("Error");
-const warning = chalk.yellow("Warning");
-const info = chalk.blue("Info");
+const error = styleText("red", "Error");
+const warning = styleText("yellow", "Warning");
+const info = styleText("blue", "Info");

 console.log(error, warning, info);
```

## Notes

### Limitations

Chalk methods that have no direct `util.styleText` equivalent — including `hex()`, `rgb()`, `ansi256()`, `bgAnsi256()`, `visible()`, and `new chalk.Chalk()` — are skipped. A warning is printed for each unsupported call, and those call sites are left unchanged for manual review.
