import type { SgRoot, SgNode, Edit } from "@codemod.com/jssg-types/main";
import type JS from "@codemod.com/jssg-types/langs/javascript";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";

/**
 * Transform function that converts Mocha v8 tests to Node.js test runner (v22, v24).
 *
 * Handles:
 * 1. Adding node:test imports/requires
 * 2. Converting done callbacks to (t, done) signature
 * 3. Converting this.skip() to t.skip()
 * 4. Converting this.timeout() to { timeout: N } options
 */
export default function transform(root: SgRoot<JS>): string | null {
  const rootNode = root.root();
  const edits: Edit[] = [];

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

  // Determine if file uses ESM or CJS
  const hasESMImports = getNodeImportStatements(root, "test").length > 0 ||
                        rootNode.findAll({ rule: { kind: "import_statement" } }).length > 0;
  const hasESMExports = rootNode.findAll({ rule: { kind: "export_statement" } }).length > 0;
  const isESM = hasESMImports || hasESMExports;

  // Check if node:test import/require already exists
  const existingNodeTestImport = isESM
    ? getNodeImportStatements(root, "test")
    : getNodeRequireCalls(root, "test");
  const hasNodeTestImport = existingNodeTestImport.length > 0;

  // Transform done callbacks
  transformDoneCallbacks(rootNode, edits);

  // Transform this.skip() calls
  transformThisSkip(rootNode, edits);

  // Transform this.timeout() calls
  transformThisTimeout(rootNode, edits);

  // Apply all edits first
  let sourceCode = edits.length > 0 ? rootNode.commitEdits(edits) : rootNode.text();

  // Transform this.timeout() using string manipulation (too complex for AST)
  sourceCode = transformTimeoutsString(sourceCode);

  // Add node:test import/require if needed (using string manipulation)
  if (!hasNodeTestImport && usedTestFunctions.size > 0) {
    sourceCode = addNodeTestImportString(sourceCode, usedTestFunctions, isESM);
  }

  // Check if anything changed
  if (sourceCode === rootNode.text()) {
    return null;
  }

  return sourceCode;
}

/**
 * Transform done callbacks:
 * - function(done) => function(t, done)
 * - (done) => => (t, done) =>
 * - async function(done) => async function()  (remove done from async)
 */
function transformDoneCallbacks(rootNode: SgNode<JS>, edits: Edit[]): void {
  const testFunctionPatterns = [
    "it",
    "before",
    "after",
    "beforeEach",
    "afterEach",
  ];

  for (const funcName of testFunctionPatterns) {
    // Process all function calls for this test function name
    const allTestCalls = rootNode.findAll({
      rule: { pattern: `${funcName}($$$)` },
    });

    for (const call of allTestCalls) {
      // Find any function expression or arrow function in this call
      const functionNode = call.find({
        rule: {
          any: [
            { kind: "function_expression" },
            { kind: "arrow_function" }
          ]
        },
      });

      if (!functionNode) continue;

      const params = functionNode.find({ rule: { kind: "formal_parameters" } });
      if (!params) continue;

      const paramsText = params.text();
      // Match (done) with optional whitespace
      const doneMatch = paramsText.match(/^\(\s*done\s*\)$/);

      if (doneMatch) {
        // Check if it's async
        const isAsync = functionNode.text().startsWith("async");

        if (isAsync) {
          // Remove done from async functions
          const edit = params.replace("()");
          edits.push(edit);
        } else {
          // Add t parameter for non-async
          const edit = params.replace("(t, done)");
          edits.push(edit);
        }
      }
    }
  }
}

/**
 * Transform this.skip() to t.skip()
 * Also add t parameter if function doesn't have it
 */
function transformThisSkip(rootNode: SgNode<JS>, edits: Edit[]): void {
  // Find all this.skip() calls
  const thisSkipCalls = rootNode.findAll({
    rule: { pattern: "this.skip($$$)" },
  });

  for (const skipCall of thisSkipCalls) {
    // Replace this.skip with t.skip
    const memberExpr = skipCall.find({
      rule: { kind: "member_expression", has: { kind: "this" } },
    });

    if (memberExpr) {
      const thisKeyword = memberExpr.find({ rule: { kind: "this" } });
      if (thisKeyword) {
        const edit = thisKeyword.replace("t");
        edits.push(edit);
      }
    }

    // Find the enclosing function and add t parameter if needed
    let functionNode = skipCall.parent();
    while (functionNode) {
      const kind = functionNode.kind();
      if (kind === "function_expression" || kind === "arrow_function") {
        break;
      }
      functionNode = functionNode.parent();
    }

    if (functionNode) {
      const params = functionNode.find({ rule: { kind: "formal_parameters" } });
      if (params) {
        const paramsText = params.text();
        // Only add t if there's no parameter or if it's just ()
        if (paramsText === "()" || paramsText === "( )") {
          const edit = params.replace("(t)");
          edits.push(edit);
        } else if (!paramsText.includes("t,") && !paramsText.startsWith("(t)")) {
          // If there are other parameters but no t, we need to be careful
          // For now, we'll handle the simple case where there's just done
          if (paramsText === "(done)" || paramsText === "(t, done)") {
            // Don't need to add t, it's already there or will be added by done transformation
          } else if (!paramsText.includes("t")) {
            // Add t as first parameter
            const innerParams = paramsText.slice(1, -1).trim();
            if (innerParams) {
              const edit = params.replace(`(t, ${innerParams})`);
              edits.push(edit);
            } else {
              const edit = params.replace("(t)");
              edits.push(edit);
            }
          }
        }
      }
    }
  }
}

/**
 * Transform this.timeout(N) calls to { timeout: N} options
 * This uses string manipulation after AST edits since it requires complex restructuring
 */
function transformThisTimeout(rootNode: SgNode<JS>, edits: Edit[]): void {
  // This transformation is too complex for simple AST edits
  // It will be handled in a post-processing step using string manipulation
}

/**
 * Transform timeout calls using string manipulation
 * Converts this.timeout(N) to { timeout: N } option objects
 */
function transformTimeoutsString(sourceCode: string): string {
  const lines = sourceCode.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if next line contains this.timeout()
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const timeoutMatch = nextLine.match(/^\s*this\.timeout\(([^)]+)\);?\s*$/);

      if (timeoutMatch) {
        const timeout = timeoutMatch[1];

        // Try to match regular function pattern
        let testMatch = line.match(
          /^(\s*)(describe|it|before|after|beforeEach|afterEach)(\.[a-z]+)?\s*\(\s*([^,]+),\s*(async\s+)?function\s*(\([^)]*\))\s*\{\s*$/,
        );

        if (testMatch) {
          const indent = testMatch[1];
          const funcName = testMatch[2];
          const modifier = testMatch[3] || "";
          const description = testMatch[4];
          const async = testMatch[5] || "";
          const params = testMatch[6];

          result.push(`${indent}${funcName}${modifier}(${description}, { timeout: ${timeout} }, ${async}function${params} {`);
          i++; // Skip the timeout line
          if (i + 1 < lines.length && lines[i + 1].trim() === "") {
            i++;
          }
          continue;
        }

        // Try to match arrow function pattern
        testMatch = line.match(
          /^(\s*)(describe|it|before|after|beforeEach|afterEach)(\.[a-z]+)?\s*\(\s*([^,]+),\s*(async\s+)?(\([^)]*\))\s*=>\s*\{\s*$/,
        );

        if (testMatch) {
          const indent = testMatch[1];
          const funcName = testMatch[2];
          const modifier = testMatch[3] || "";
          const description = testMatch[4];
          const async = testMatch[5] || "";
          const params = testMatch[6];

          result.push(`${indent}${funcName}${modifier}(${description}, { timeout: ${timeout} }, ${async}${params} => {`);
          i++; // Skip the timeout line
          if (i + 1 < lines.length && lines[i + 1].trim() === "") {
            i++;
          }
          continue;
        }

        // Try to match hooks without description (regular function)
        testMatch = line.match(
          /^(\s*)(before|after|beforeEach|afterEach)(\.[a-z]+)?\s*\(\s*(async\s+)?function\s*(\([^)]*\))\s*\{\s*$/,
        );

        if (testMatch) {
          const indent = testMatch[1];
          const funcName = testMatch[2];
          const modifier = testMatch[3] || "";
          const async = testMatch[4] || "";
          const params = testMatch[5];

          result.push(`${indent}${funcName}${modifier}({ timeout: ${timeout} }, ${async}function${params} {`);
          i++; // Skip the timeout line
          if (i + 1 < lines.length && lines[i + 1].trim() === "") {
            i++;
          }
          continue;
        }

        // Try to match hooks without description (arrow function)
        testMatch = line.match(
          /^(\s*)(before|after|beforeEach|afterEach)(\.[a-z]+)?\s*\(\s*(async\s+)?(\([^)]*\))\s*=>\s*\{\s*$/,
        );

        if (testMatch) {
          const indent = testMatch[1];
          const funcName = testMatch[2];
          const modifier = testMatch[3] || "";
          const async = testMatch[4] || "";
          const params = testMatch[5];

          result.push(`${indent}${funcName}${modifier}({ timeout: ${timeout} }, ${async}${params} => {`);
          i++; // Skip the timeout line
          if (i + 1 < lines.length && lines[i + 1].trim() === "") {
            i++;
          }
          continue;
        }
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

/**
 * Add node:test import or require statement using string manipulation
 */
function addNodeTestImportString(
  sourceCode: string,
  usedFunctions: Set<string>,
  isESM: boolean
): string {
  const testImports = Array.from(usedFunctions).sort();

  if (isESM) {
    // ESM - add import statement
    const importStatement = `import { ${testImports.join(", ")} } from "node:test";\n`;
    // Insert after first import or at the beginning
    const firstImportMatch = sourceCode.match(
      /^import\s+.*from\s+['"][^'"]+['"];?\s*$/m
    );
    if (firstImportMatch && firstImportMatch.index !== undefined) {
      const insertPos = firstImportMatch.index + firstImportMatch[0].length;
      return (
        sourceCode.slice(0, insertPos) +
        "\n" +
        importStatement +
        sourceCode.slice(insertPos)
      );
    } else {
      return importStatement + sourceCode;
    }
  } else {
    // CJS
    const requireStatement = `\n\nconst {\n  ${testImports.join(",\n  ")}\n} = require("node:test");\n`;
    // Insert after first require or at the beginning
    const firstRequireMatch = sourceCode.match(
      /^const\s+.*=\s*require\([^)]+\);?\s*$/m
    );
    if (firstRequireMatch && firstRequireMatch.index !== undefined) {
      const insertPos = firstRequireMatch.index + firstRequireMatch[0].length;
      return (
        sourceCode.slice(0, insertPos) +
        requireStatement +
        sourceCode.slice(insertPos)
      );
    } else {
      return requireStatement + sourceCode;
    }
  }
}
