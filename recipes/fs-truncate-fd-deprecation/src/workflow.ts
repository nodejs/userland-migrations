import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import type { SgRoot, Edit, SgNode } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

/**
 * Transform function that converts deprecated fs.truncate calls to fs.ftruncate.
 *
 * See DEP0081: https://nodejs.org/api/deprecations.html#DEP0081
 *
 * Handles:
 * 1. fs.truncate(fd, len, callback) -> fs.ftruncate(fd, len, callback)
 * 2. fs.truncateSync(fd, len) -> fs.ftruncateSync(fd, len)
 * 3. truncate(fd, len, callback) -> ftruncate(fd, len, callback) (destructured imports)
 * 4. truncateSync(fd, len) -> ftruncateSync(fd, len) (destructured imports)
 * 5. Import/require statement updates to replace truncate/truncateSync with ftruncate/ftruncateSync
 */
export default function transform(root: SgRoot<Js>): string | null {
  const rootNode = root.root();
  const edits: Edit[] = [];
  let hasChanges = false;

  // Track what imports need to be updated
  let usedTruncate = false;
  let usedTruncateSync = false;

  // Find fs.truncate and fs.truncateSync calls (these are always safe to transform)
  const fsTruncateCalls = rootNode.findAll({
    rule: {
      any: [
        { pattern: "fs.truncate($FD, $LEN, $CALLBACK)" },
        { pattern: "fs.truncate($FD, $LEN)" },
        { pattern: "fs.truncateSync($FD, $LEN)" }
      ]
    }
  });

  // Transform fs.truncate calls
  for (const call of fsTruncateCalls) {
    const fdMatch = call.getMatch("FD");
    const lenMatch = call.getMatch("LEN");
    const callbackMatch = call.getMatch("CALLBACK");

    if (!fdMatch || !lenMatch) continue;

    const fd = fdMatch.text();
    const len = lenMatch.text();
    const callback = callbackMatch?.text();
    const callText = call.text();

    let newCallText: string;
    if (callText.includes("fs.truncateSync(")) {
      newCallText = `fs.ftruncateSync(${fd}, ${len})`;
    } else {
      newCallText = callback
        ? `fs.ftruncate(${fd}, ${len}, ${callback})`
        : `fs.ftruncate(${fd}, ${len})`;
    }

    edits.push(call.replace(newCallText));
    hasChanges = true;
  }

  // Find destructured truncate/truncateSync calls (need scope analysis)
  const destructuredCalls = rootNode.findAll({
    rule: {
      any: [
        { pattern: "truncate($FD, $LEN, $CALLBACK)" },
        { pattern: "truncate($FD, $LEN)" },
        { pattern: "truncateSync($FD, $LEN)" }
      ]
    }
  });

  // Transform destructured calls only if they're from fs imports/requires
  for (const call of destructuredCalls) {
    if (isFromFsModule(call, root)) {
      const fdMatch = call.getMatch("FD");
      const lenMatch = call.getMatch("LEN");
      const callbackMatch = call.getMatch("CALLBACK");

      if (!fdMatch || !lenMatch) continue;

      const fd = fdMatch.text();
      const len = lenMatch.text();
      const callback = callbackMatch?.text();
      const callText = call.text();

      // Check if this looks like a file descriptor
      if (isLikelyFileDescriptor(fd, rootNode)) {
        let newCallText: string;

        if (callText.includes("truncateSync(")) {
          newCallText = `ftruncateSync(${fd}, ${len})`;
          usedTruncateSync = true;
        } else {
          newCallText = callback
            ? `ftruncate(${fd}, ${len}, ${callback})`
            : `ftruncate(${fd}, ${len})`;
          usedTruncate = true;
        }

        edits.push(call.replace(newCallText));
        hasChanges = true;
      }
    }
  }

  // Update imports/requires if we have destructured calls that were transformed
  if (usedTruncate || usedTruncateSync) {
    updateImportsAndRequires(root, usedTruncate, usedTruncateSync, edits);
    hasChanges = true;
  }

  if (!hasChanges) return null;

  return rootNode.commitEdits(edits);
}

/**
 * Update import and require statements to replace truncate functions with ftruncate
 */
function updateImportsAndRequires(root: SgRoot<Js>, usedTruncate: boolean, usedTruncateSync: boolean, edits: Edit[]): void {
  // @ts-ignore - ast-grep types are not fully compatible with JSSG types
  const importStatements = getNodeImportStatements(root, 'fs');
  // @ts-ignore - ast-grep types are not fully compatible with JSSG types
  const requireStatements = getNodeRequireCalls(root, 'fs');

  // Update import and require statements
  for (const statement of [...importStatements, ...requireStatements]) {
    let text = statement.text();
    let updated = false;

    if (usedTruncate && text.includes("truncate") && !text.includes("ftruncate")) {
      text = text.replace(/\btruncate\b/g, "ftruncate");
      updated = true;
    }

    if (usedTruncateSync && text.includes("truncateSync") && !text.includes("ftruncateSync")) {
      text = text.replace(/\btruncateSync\b/g, "ftruncateSync");
      updated = true;
    }

    if (updated) {
      edits.push(statement.replace(text));
    }
  }
}

/**
 * Check if a call expression is from a destructured fs import/require
 */
function isFromFsModule(call: SgNode<Js>, root: SgRoot<Js>): boolean {
  // @ts-ignore - ast-grep types are not fully compatible with JSSG types
  const importStatements = getNodeImportStatements(root, 'fs');
  // @ts-ignore - ast-grep types are not fully compatible with JSSG types
  const requireStatements = getNodeRequireCalls(root, 'fs');

  // Get the function name being called (truncate or truncateSync)
  const callExpression = call.child(0);
  const functionName = callExpression?.text();
  if (!functionName) return false;

  // Check if this function name appears in any fs import/require destructuring
  for (const statement of [...importStatements, ...requireStatements]) {
    const text = statement.text();
    if (text.includes("{") && text.includes(functionName)) {
      return true;
    }
  }

  return false;
}

/**
 * Helper function to determine if a parameter is likely a file descriptor
 * rather than a file path string.
 * @param param The parameter to check (e.g., 'fd').
 * @param rootNode The root node of the AST to search within.
 */
function isLikelyFileDescriptor(param: string, rootNode: SgNode<Js>): boolean {
  // Check if it's a numeric literal
  if (/^\d+$/.test(param.trim())) return true;

  // Check if it's obviously a string literal (path)
  if (/^['"`]/.test(param.trim())) return false;

  // Check if it's assigned from fs.openSync or openSync
  if (isAssignedFromOpenSync(param, rootNode)) return true;

  // Check if it's used inside a callback context from fs.open
  if (isInCallbackContext(param, rootNode)) return true;

  // For other cases, be conservative - don't transform unless we're sure
  return false;
}

/**
 * Check if the parameter is used inside a callback context from fs.open
 * @param param The parameter name to check
 * @param rootNode The root node of the AST
 */
function isInCallbackContext(param: string, rootNode: SgNode<Js>): boolean {
  // Find all uses of the parameter
  const parameterUsages = rootNode.findAll({
    rule: {
      kind: "identifier",
      regex: `^${param}$`
    }
  });

  for (const usage of parameterUsages) {
    // Check if this usage is inside a callback parameter for fs.open or open
    const isInOpenCallback = usage.inside({
      rule: {
        kind: "call_expression",
        has: {
          field: "function",
          any: [
            {
              kind: "member_expression",
              all: [
                { has: { field: "object", kind: "identifier", regex: "^fs$" } },
                { has: { field: "property", kind: "property_identifier", regex: "^open$" } }
              ]
            },
            {
              kind: "identifier",
              regex: "^open$"
            }
          ]
        }
      }
    });

    if (isInOpenCallback) return true;
  }

  return false;
}

/**
 * Check if there's a variable that's assigned from fs.openSync
 * @param param The parameter name to check
 * @param rootNode The root node of the AST
 */
function isAssignedFromOpenSync(param: string, rootNode: SgNode<Js>): boolean {
  // Search for variable declarations or assignments from fs.openSync or openSync
  const openSyncAssignments = rootNode.findAll({
    rule: {
      any: [
        {
          kind: "variable_declarator",
          all: [
            { has: { field: "name", kind: "identifier", regex: `^${param}$` } },
            {
              has: {
                field: "value",
                kind: "call_expression",
                has: {
                  field: "function",
                  any: [
                    {
                      kind: "member_expression",
                      all: [
                        { has: { field: "object", kind: "identifier", regex: "^fs$" } },
                        { has: { field: "property", kind: "property_identifier", regex: "^openSync$" } }
                      ]
                    },
                    {
                      kind: "identifier",
                      regex: "^openSync$"
                    }
                  ]
                }
              }
            }
          ]
        },
        {
          kind: "assignment_expression",
          all: [
            { has: { field: "left", kind: "identifier", regex: `^${param}$` } },
            {
              has: {
                field: "right",
                kind: "call_expression",
                has: {
                  field: "function",
                  any: [
                    {
                      kind: "member_expression",
                      all: [
                        { has: { field: "object", kind: "identifier", regex: "^fs$" } },
                        { has: { field: "property", kind: "property_identifier", regex: "^openSync$" } }
                      ]
                    },
                    {
                      kind: "identifier",
                      regex: "^openSync$"
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    }
  });

  return openSyncAssignments.length > 0;
}
