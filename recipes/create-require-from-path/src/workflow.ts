import type { SgRoot, Edit } from "@ast-grep/napi";

export default function transform(root: SgRoot): string | null {
  const rootNode = root.root();
  const edits: Edit[] = [];
  let hasChanges = false;

  // Step 1: Find and update import/require statements that import createRequireFromPath
  const importNodes = rootNode.findAll({
    rule: {
      any: [
        // Handle require destructuring
        {
          kind: "lexical_declaration",
          has: {
            kind: "variable_declarator",
            has: {
              field: "value",
              pattern: `require('module')`
            }
          }
        },
        {
          kind: "lexical_declaration",
          has: {
            kind: "variable_declarator",
            has: {
              field: "value",
              pattern: `require('node:module')`
            }
          }
        },
        // Handle import statements
        {
          kind: "import_statement",
          has: {
            field: "source",
            kind: "string",
            regex: "^'(node:)?module'$"
          }
        }
      ]
    }
  });

  for (const importNode of importNodes) {
    const text = importNode.text();

    // Check if this import/require includes createRequireFromPath
    if (text.includes("createRequireFromPath")) {
      // Replace createRequireFromPath with createRequire
      const newText = text.replace(/createRequireFromPath/g, "createRequire");
      edits.push(importNode.replace(newText));
      hasChanges = true;
    }
  }

  // Step 2: Find variable declarations that use createRequireFromPath and track the variable names
  const createRequireFromPathUsages = rootNode.findAll({
    rule: {
      pattern: 'const $VAR = createRequireFromPath($ARG)'
    }
  });

  const variableMapping = new Map<string, string>();

  for (const usage of createRequireFromPathUsages) {
    const varMatch = usage.getMatch("VAR");
    const argMatch = usage.getMatch("ARG");

    if (varMatch && argMatch) {
      const oldVarName = varMatch.text();
      const arg = argMatch.text();

      // Get the original text to preserve semicolons
      const originalText = usage.text();
      const hasSemicolon = originalText.endsWith(';');

      // Replace the declaration
      const replacement = `const require = createRequire(${arg})${hasSemicolon ? ';' : ''}`;
      edits.push(usage.replace(replacement));

      // Track the variable name change
      variableMapping.set(oldVarName, "require");
      hasChanges = true;
    }
  }

  // Step 3: Find and update all usages of the old variable names
  for (const [oldName, newName] of variableMapping) {
    const callExpressions = rootNode.findAll({
      rule: {
        pattern: `${oldName}($$$ARGS)`
      }
    });

    for (const callExpr of callExpressions) {
      const argsMatches = callExpr.getMultipleMatches("ARGS");
      const argsText = argsMatches.map(arg => arg.text()).join(", ");
      const replacement = `${newName}(${argsText})`;
      edits.push(callExpr.replace(replacement));
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    return null;
  }

  return rootNode.commitEdits(edits);
}
