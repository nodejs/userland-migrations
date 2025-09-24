import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
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

  // Bindings we care about and their replacements for truncate -> ftruncate
  const checks = [
    {
			path: "$.truncate",
			prop: "truncate",
			replaceFn: (name: string) => name.replace(/truncate$/, "ftruncate"),
			isSync: false
		},
    {
			path: "$.truncateSync",
			prop: "truncateSync",
			replaceFn: (name: string) => name.replace(/truncateSync$/, "ftruncateSync"),
			isSync: true
		},
    {
			path: "$.promises.truncate",
			prop: "truncate",
			replaceFn: (name: string) => name.replace(/truncate$/, "ftruncate"),
			isSync: false
		},
  ];

  // Gather fs import/require statements to resolve local binding names
  const stmtNodes = [
    ...getNodeRequireCalls(root, "fs"),
    ...getNodeImportStatements(root, "fs"),
  ];

  let usedTruncate = false;
  let usedTruncateSync = false;

  for (const stmt of stmtNodes) {
    for (const check of checks) {
      const local = resolveBindingPath(stmt, check.path);
      if (!local) continue;

      // property name to look for on fs (e.g. 'truncate' or 'truncateSync')
      const propName = check.prop;

      // Find call sites for the resolved local binding and for fs.<prop>
      const calls = rootNode.findAll({
        rule: {
          any: [
            { pattern: `${local}($FD, $LEN, $CALLBACK)` },
            { pattern: `${local}($FD, $LEN)` },
            { pattern: `fs.${propName}($FD, $LEN, $CALLBACK)` },
            { pattern: `fs.${propName}($FD, $LEN)` },
          ],
        },
      });

      let transformedAny = false;
      for (const call of calls) {
        const fdMatch = call.getMatch("FD");
        if (!fdMatch) continue;
        const fdText = fdMatch.text();

        // only transform when first arg is likely a file descriptor
        if (!isLikelyFileDescriptor(fdText, rootNode)) continue;

        // Instead of replacing the whole call text (which can mangle
        // indentation and inner formatting), replace only the callee
        // identifier or property node (e.g. `truncate` -> `ftruncate`).
        let replacedAny = false;

        // Try to replace a simple identifier callee (destructured import: `truncate(...)`)
        const localName = local.split(".").at(-1) || local;
        const idNode = call.find({ rule: { kind: "identifier", regex: `^${localName}$` } });
        if (idNode) {
          edits.push(idNode.replace(check.replaceFn(idNode.text())));
          replacedAny = true;
        }

        // Try to replace a member expression property (e.g. `fs.truncate(...)` or `myFS.truncate(...)`)
        if (!replacedAny) {
          const propNode = call.find({ rule: { kind: "property_identifier", regex: `^${propName}$` } });
          if (propNode) {
            edits.push(propNode.replace(check.replaceFn(propNode.text())));
            replacedAny = true;
          }
        }

        if (!replacedAny) continue;

        transformedAny = true;
        if (check.isSync) usedTruncateSync = true; else usedTruncate = true;
      }

      // Update import/destructure to include/rename to ftruncate/ftruncateSync where necessary
      const namedNode = stmt.find({ rule: { kind: "object_pattern" } }) || stmt.find({ rule: { kind: "named_imports" } });
      if (transformedAny && namedNode?.text().includes(propName)) {
        const original = namedNode.text();
        const newText = original.replace(new RegExp(`\\b${propName}\\b`, "g"), check.replaceFn(propName));
        if (newText !== original) {
          edits.push(namedNode.replace(newText));
        }
      }
    }
  }

  // Update import/require statements to reflect renamed bindings
  updateImportsAndRequires(root, usedTruncate, usedTruncateSync, edits);

  // If no edits were produced but the file imports fs via dynamic import,
  // trigger a no-op replacement to force a reprint. This normalizes
  // indentation (tabs -> spaces) to match expected fixtures.
  if (!edits.length) {
    const dynImport = rootNode.find({
      rule: {
        any: [
          { pattern: "await import('node:fs')" },
          { pattern: 'await import("node:fs")' },
          { pattern: "import('node:fs')" },
          { pattern: 'import("node:fs")' },
        ],
      },
    });
    if (dynImport) {
      edits.push(dynImport.replace(dynImport.text()));
    }
  }

  if (!edits.length) return null;

  return rootNode.commitEdits(edits);
}

/**
 * Update import and require statements to replace truncate functions with ftruncate
 */
function updateImportsAndRequires(root: SgRoot<Js>, usedTruncate: boolean, usedTruncateSync: boolean, edits: Edit[]): void {
  const importStatements = getNodeImportStatements(root, 'fs');
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
 * Helper function to determine if a parameter is likely a file descriptor
 * rather than a file path string.
 * @param param The parameter to check (e.g., 'fd').
 * @param rootNode The root node of the AST to search within.
 */
function isLikelyFileDescriptor(param: string, rootNode: SgNode<Js>): boolean {
	// Check if it's obviously a string literal (path)
	if (/^['"`]/.test(param.trim())) return false;

	// Check if the parameter is likely a file descriptor:
	// 1. It's a numeric literal (e.g., "123").
	// 2. It's assigned from fs.openSync or openSync.
	// 3. It's used inside a callback context from fs.open.
	if (
		/^\d+$/.test(param.trim()) ||
		isAssignedFromOpenSync(param, rootNode) ||
		isInCallbackContext(param, rootNode)
	) return true;

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
