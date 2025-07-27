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

  // Find all truncate and truncateSync calls
  const truncateCalls = rootNode.findAll({
    rule: {
      any: [
        { pattern: "fs.truncate($FD, $LEN, $CALLBACK)" },
        { pattern: "fs.truncate($FD, $LEN)" },
        { pattern: "truncate($FD, $LEN, $CALLBACK)" },
        { pattern: "truncate($FD, $LEN)" }
      ]
    }
  });

  const truncateSyncCalls = rootNode.findAll({
    rule: {
      any: [
        { pattern: "fs.truncateSync($FD, $LEN)" },
        { pattern: "truncateSync($FD, $LEN)" }
      ]
    }
  });

  // Transform truncate calls
  for (const call of truncateCalls) {
    const fdMatch = call.getMatch("FD");
    const lenMatch = call.getMatch("LEN");
    const callbackMatch = call.getMatch("CALLBACK");

    if (!fdMatch || !lenMatch) continue;

    const fd = fdMatch.text();
    const len = lenMatch.text();
    const callback = callbackMatch?.text();
    const callText = call.text();

    // Check if this looks like a file descriptor (numeric or variable from open)
    if (isLikelyFileDescriptor(fd, rootNode)) {
      if (callText.includes("fs.truncate(")) {
        const newCallText = callback
          ? `fs.ftruncate(${fd}, ${len}, ${callback})`
          : `fs.ftruncate(${fd}, ${len})`;
        edits.push(call.replace(newCallText));
      } else {
        // destructured call like truncate(...)
        const newCallText = callback
          ? `ftruncate(${fd}, ${len}, ${callback})`
          : `ftruncate(${fd}, ${len})`;
        edits.push(call.replace(newCallText));
        usedTruncate = true;
      }
      hasChanges = true;
    }
  }

  // Transform truncateSync calls
  for (const call of truncateSyncCalls) {
    const fdMatch = call.getMatch("FD");
    const lenMatch = call.getMatch("LEN");

    if (!fdMatch || !lenMatch) continue;

    const fd = fdMatch.text();
    const len = lenMatch.text();
    const callText = call.text();

    // Check if this looks like a file descriptor
    if (isLikelyFileDescriptor(fd, rootNode)) {
      if (callText.includes("fs.truncateSync(")) {
        const newCallText = `fs.ftruncateSync(${fd}, ${len})`;
        edits.push(call.replace(newCallText));
      } else {
        // destructured call like truncateSync(...)
        const newCallText = `ftruncateSync(${fd}, ${len})`;
        edits.push(call.replace(newCallText));
        usedTruncateSync = true;
      }
      hasChanges = true;
    }
  }

  // Update imports/requires if we have destructured calls that were transformed
  if (usedTruncate || usedTruncateSync) {
    // @ts-ignore - ast-grep types are not fully compatible with JSSG types
    const importStatements = getNodeImportStatements(root, 'fs');

    // Update import statements
    for (const importNode of importStatements) {
      const namedImports = importNode.find({ rule: { kind: 'named_imports' } });
      if (!namedImports) continue;

      let importText = importNode.text();
      let updated = false;

      if (usedTruncate && importText.includes("truncate") && !importText.includes("ftruncate")) {
        // Replace truncate with ftruncate in imports
        importText = importText.replace(/\btruncate\b/g, "ftruncate");
        updated = true;
      }

      if (usedTruncateSync && importText.includes("truncateSync") && !importText.includes("ftruncateSync")) {
        // Replace truncateSync with ftruncateSync in imports
        importText = importText.replace(/\btruncateSync\b/g, "ftruncateSync");
        updated = true;
      }

      if (updated) {
        edits.push(importNode.replace(importText));
        hasChanges = true;
      }
    }

    // @ts-ignore - ast-grep types are not fully compatible with JSSG types
    const requireStatements = getNodeRequireCalls(root, 'fs');

    // Update require statements
    for (const requireNode of requireStatements) {
      let requireText = requireNode.text();
      let updated = false;

      if (usedTruncate && requireText.includes("truncate") && !requireText.includes("ftruncate")) {
        // Replace truncate with ftruncate in requires
        requireText = requireText.replace(/\btruncate\b/g, "ftruncate");
        updated = true;
      }

      if (usedTruncateSync && requireText.includes("truncateSync") && !requireText.includes("ftruncateSync")) {
        // Replace truncateSync with ftruncateSync in requires
        requireText = requireText.replace(/\btruncateSync\b/g, "ftruncateSync");
        updated = true;
      }

      if (updated) {
        edits.push(requireNode.replace(requireText));
        hasChanges = true;
      }
    }
  }

  if (!hasChanges) return null;

  return rootNode.commitEdits(edits);
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

  // Check if parameter is in a callback context
  if (isInCallbackContext(param, rootNode)) return true;

  // Check if there's a variable in scope that assigns a file descriptor
  if (hasFileDescriptorVariable(param, rootNode)) return true;

  // If we didn't find any indicators, assume it's not a file descriptor
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
    // Check if this usage is inside a callback parameter list for fs.open
    const isInFsOpenCallback = usage.inside({
      rule: {
        kind: "call_expression",
        all: [
          {
            has: {
              field: "function",
              kind: "member_expression",
              all: [
                {
                  has: {
                    field: "object",
                    kind: "identifier",
                    regex: "^fs$"
                  }
                },
                {
                  has: {
                    field: "property",
                    kind: "property_identifier",
                    regex: "^open$"
                  }
                }
              ]
            }
          },
          {
            has: {
              field: "arguments",
              kind: "arguments",
              has: {
                any: [
                  {
                    kind: "arrow_function",
                    has: {
                      field: "parameters",
                      kind: "formal_parameters",
                      has: {
												// @ts-ignore - jssg-types arren't happy but jssg work with type_error
                        kind: "required_parameter",
                        has: {
                          field: "pattern",
                          kind: "identifier",
                          regex: `^${param}$`
                        }
                      }
                    }
                  },
                  {
                    kind: "function_expression",
                    has: {
                      field: "parameters",
                      kind: "formal_parameters",
                      has: {
												// @ts-ignore - jssg-types arren't happy but jssg work with type_error
                        kind: "required_parameter",
                        has: {
                          field: "pattern",
                          kind: "identifier",
                          regex: `^${param}$`
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        ]
      }
    });

    // Check if this usage is inside a callback parameter list for destructured open
    const isInDestructuredOpenCallback = usage.inside({
      rule: {
        kind: "call_expression",
        all: [
          {
            has: {
              field: "function",
              kind: "identifier",
              regex: "^open$"
            }
          },
          {
            has: {
              field: "arguments",
              kind: "arguments",
              has: {
                any: [
                  {
                    kind: "arrow_function",
                    has: {
                      field: "parameters",
                      kind: "formal_parameters",
                      has: {
												// @ts-ignore - jssg-types arren't happy but jssg work with type_error
                        kind: "required_parameter",
                        has: {
                          field: "pattern",
                          kind: "identifier",
                          regex: `^${param}$`
                        }
                      }
                    }
                  },
                  {
                    kind: "function_expression",
                    has: {
                      field: "parameters",
                      kind: "formal_parameters",
                      has: {
												// @ts-ignore - jssg-types arren't happy but jssg work with type_error
                        kind: "required_parameter",
                        has: {
                          field: "pattern",
                          kind: "identifier",
                          regex: `^${param}$`
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        ]
      }
    });

    if (isInFsOpenCallback || isInDestructuredOpenCallback) {
      return true;
    }
  }

  return false;
}

/**
 * Check if there's a variable in scope that assigns a file descriptor value
 * @param param The parameter name to check
 * @param rootNode The root node of the AST
 */
function hasFileDescriptorVariable(param: string, rootNode: SgNode<Js>): boolean {
  // Search for variable declarations that assign from fs.openSync
  const syncVariableDeclarators = rootNode.findAll({
    rule: {
      kind: "variable_declarator",
      all: [
        {
          has: {
            field: "name",
            kind: "identifier",
            regex: `^${param}$`
          }
        },
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
                    {
                      has: {
                        field: "object",
                        kind: "identifier",
                        regex: "^fs$"
                      }
                    },
                    {
                      has: {
                        field: "property",
                        kind: "property_identifier",
                        regex: "^openSync$"
                      }
                    }
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
  });

  if (syncVariableDeclarators.length > 0) return true;

  // Search for assignment expressions that assign from fs.openSync
  const syncAssignments = rootNode.findAll({
    rule: {
      kind: "assignment_expression",
      all: [
        {
          has: {
            field: "left",
            kind: "identifier",
            regex: `^${param}$`
          }
        },
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
                    {
                      has: {
                        field: "object",
                        kind: "identifier",
                        regex: "^fs$"
                      }
                    },
                    {
                      has: {
                        field: "property",
                        kind: "property_identifier",
                        regex: "^openSync$"
                      }
                    }
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
  });

  if (syncAssignments.length > 0) return true;

  // Check if the variable is assigned from another variable that's a file descriptor
  const variableAssignments = rootNode.findAll({
    rule: {
      kind: "variable_declarator",
      all: [
        {
          has: {
            field: "name",
            kind: "identifier",
            regex: `^${param}$`
          }
        },
        {
          has: {
            field: "value",
            kind: "identifier"
          }
        }
      ]
    }
  });

  for (const assignment of variableAssignments) {
    const valueNode = assignment.field("value");
    if (valueNode) {
      const sourceVar = valueNode.text();
      // Recursively check if the source variable is a file descriptor
      if (hasFileDescriptorVariable(sourceVar, rootNode)) {
        return true;
      }
    }
  }

  return false;
}
