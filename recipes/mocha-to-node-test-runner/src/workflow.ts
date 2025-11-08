import type { SgRoot, SgNode, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transform function that converts Mocha v8 tests to Node.js test runner (v22, v24).
 *
 * Handles:
 * 1. Adding node:test imports/requires
 * 2. Converting done callbacks to (t, done) signature
 * 3. Converting this.skip() to t.skip()
 * 4. Converting this.timeout() to { timeout: N } options
 * 5. Preserving function styles (not converting function() to arrow functions)
 * 6. Supporting both CJS and ESM
 */
export default function transform(root: SgRoot<JS>): string | null {
  const rootNode = root.root();
  let sourceCode = rootNode.text();

  // Track which test functions are used
  const usedTestFunctions = new Set<string>();
  const testFunctions = [
    "describe",
    "it",
    "before",
    "after",
    "beforeEach",
    "afterEach",
  ];

  // Check which test functions are actually used
  for (const funcName of testFunctions) {
    const pattern1 = `${funcName}($$$)`;
    const pattern2 = `${funcName}.skip($$$)`;
    const pattern3 = `${funcName}.only($$$)`;

    const calls1 = rootNode.findAll({ rule: { pattern: pattern1 } });
    const calls2 = rootNode.findAll({ rule: { pattern: pattern2 } });
    const calls3 = rootNode.findAll({ rule: { pattern: pattern3 } });

    if (calls1.length > 0 || calls2.length > 0 || calls3.length > 0) {
      usedTestFunctions.add(funcName);
    }
  }

  // If no test functions are used, nothing to transform
  if (usedTestFunctions.size === 0) {
    return null;
  }

  // Determine if file uses ESM or CJS using simple regex
  const hasImports = /^\s*import\s+/m.test(sourceCode);
  const hasExports = /^\s*export\s+/m.test(sourceCode);
  const isESM = hasImports || hasExports;

  // Check if node:test import/require already exists
  const hasNodeTestImport =
    /from\s+['"]node:test['"]/.test(sourceCode) ||
    /require\s*\(\s*['"]node:test['"]\s*\)/.test(sourceCode);

  // Transform async functions with done parameter - remove done
  sourceCode = sourceCode.replace(
    /async\s+function\s*\(\s*done\s*\)/g,
    "async function()",
  );

  // Transform non-async function(done) to function(t, done) for test functions
  // But we need to be careful - only for it, not describe
  sourceCode = sourceCode.replace(
    /\b(it|before|after|beforeEach|afterEach)(\.[a-z]+)?\s*\(\s*([^,)]+)\s*,\s*function\s*\(\s*done\s*\)/g,
    "$1$2($3, function(t, done)",
  );

  // Handle functions with this.skip() - add t parameter if not already present
  // This requires finding functions that contain this.skip()
  const thisSkipPattern =
    /\b(it|before|after|beforeEach|afterEach)(\.[a-z]+)?\s*\(\s*([^,)]+)\s*,\s*function\s*\(\s*\)\s*\{[^}]*this\.skip\(\)/g;
  sourceCode = sourceCode.replace(thisSkipPattern, (match) => {
    return match.replace(/function\s*\(\s*\)/, "function(t)");
  });

  // Transform this.skip() to t.skip()
  sourceCode = sourceCode.replace(/\bthis\.skip\(/g, "t.skip(");

  // Handle timeout transformations
  // We need to handle this.timeout() calls at the beginning of function bodies
  // Transform them to timeout options

  // Match pattern: function() { \n  this.timeout(N);
  // and extract the timeout value, then remove the this.timeout line and add options

  // Process each line and track timeout transformations
  const lines = sourceCode.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if next line contains this.timeout()
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const timeoutMatch = nextLine.match(/^\s*this\.timeout\((\d+)\);?\s*$/);

      // Check if current line is a test function call
      const testMatch = line.match(
        /^(\s*)(describe|it|before|after|beforeEach|afterEach)(\.[a-z]+)?\s*\(\s*([^,]+),\s*function\s*(\([^)]*\))\s*\{\s*$/,
      );

      if (testMatch && timeoutMatch) {
        const indent = testMatch[1];
        const funcName = testMatch[2];
        const modifier = testMatch[3] || "";
        const description = testMatch[4];
        const params = testMatch[5];
        const timeout = timeoutMatch[1];

        // Check if params include done
        const hasDone = params.includes("done");
        const newParams = hasDone ? "(t, done)" : " ()";

        // Add the transformed line with timeout option
        result.push(`${indent}${funcName}${modifier}(${description}, {`);
        result.push(`${indent}  timeout: ${timeout}`);
        result.push(`${indent}}, function${newParams} {`);

        // Skip the next line (this.timeout)
        i++;

        // Also skip the following blank line if it exists
        if (i + 1 < lines.length && lines[i + 1].trim() === "") {
          i++;
        }
        continue;
      }
    }

    result.push(line);
  }

  sourceCode = result.join("\n");

  // If we need to add node:test import/require and it doesn't exist
  if (!hasNodeTestImport && usedTestFunctions.size > 0) {
    const testImports = Array.from(usedTestFunctions).sort();

    if (isESM) {
      // ESM - add import statement
      const importStatement = `import { ${testImports.join(", ")} } from "node:test";\n`;
      // Insert after first import or at the beginning
      const firstImportMatch = sourceCode.match(
        /^import\s+.*from\s+['"][^'"]+['"];?\s*$/m,
      );
      if (firstImportMatch && firstImportMatch.index !== undefined) {
        const insertPos = firstImportMatch.index + firstImportMatch[0].length;
        sourceCode =
          sourceCode.slice(0, insertPos) +
          "\n" +
          importStatement +
          sourceCode.slice(insertPos);
      } else {
        sourceCode = importStatement + sourceCode;
      }
    } else {
      // CJS
      const requireStatement = `\nconst {\n  ${testImports.join(",\n  ")}\n} = require("node:test");\n`;
      // Insert after first require or at the beginning
      const firstRequireMatch = sourceCode.match(
        /^const\s+.*=\s*require\([^)]+\);?\s*$/m,
      );
      if (firstRequireMatch && firstRequireMatch.index !== undefined) {
        const insertPos = firstRequireMatch.index + firstRequireMatch[0].length;
        sourceCode =
          sourceCode.slice(0, insertPos) +
          "\n" +
          requireStatement +
          sourceCode.slice(insertPos);
      } else {
        sourceCode = requireStatement + sourceCode;
      }
    }
  }

  // Check if anything changed
  if (sourceCode === rootNode.text()) {
    return null;
  }

  return sourceCode;
}
