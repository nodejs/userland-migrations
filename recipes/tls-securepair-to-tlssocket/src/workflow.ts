import { getNodeImportStatements, getNodeImportCalls } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { updateBinding } from "@nodejs/codemod-utils/ast-grep/update-binding";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";

import type { Edit, SgRoot, Range, SgNode } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

// This codemod transforms usages of `tls.SecurePair` to `tls.TLSSocket`.
// It updates imports/requires, replaces `new SecurePair(...)` expressions,
// renames local variables, and removes obsolete `cleartext`/`encrypted` usages.

function getClosest(node: SgNode<Js>, kinds: string[]): SgNode<Js> | null {
  // Prefer the shared `getScope` helper when a single kind is requested.

  // Walk up the ancestor chain and return the first matching kind.
  let current = node.parent();
  while (current) {
    if (kinds.includes(current.kind())) return current;
    current = current.parent();
  }

  return null;
}

// Helper: find the closest ancestor node whose kind is one of `kinds`.

export default function transform(root: SgRoot<Js>): string | null {
  const rootNode = root.root();
  const edits: Edit[] = [];
  const linesToRemove: Range[] = [];

  // Collect all import/require nodes that reference the `tls` module.
  // This includes static imports, require() calls and dynamic imports.
  const importNodes = [
    ...getNodeImportStatements(root, "tls"),
    ...getNodeRequireCalls(root, "tls"),
    ...getNodeImportCalls(root, "tls")
  ];

  for (const node of importNodes) {
    // Update any binding that imports SecurePair -> TLSSocket (e.g. import { SecurePair })
    const change = updateBinding(node, { old: "SecurePair", new: "TLSSocket" });
    if (change?.edit) edits.push(change.edit);
    if (change?.lineToRemove) linesToRemove.push(change.lineToRemove);
  }

  // Find `new` expressions that construct a SecurePair either via namespace
  const newExpressions = rootNode.findAll({
    rule: {
      kind: "new_expression",
      has: {
        any: [
          { kind: "member_expression" },
          { kind: "identifier" }
        ]
      }
    }
  });

  for (const node of newExpressions) {
    const callee = node.field("constructor");
    if (!callee) continue;

    // Enforce exact matching at runtime: pattern in the AST query can match
    // substrings, so verify we actually have `SecurePair`.
    let isExact = false;
    if (callee.kind() === "member_expression") {
      const property = callee.field("property");
      if (property && property.text() === "SecurePair") isExact = true;
    } else if (callee.kind() === "identifier") {
      if (callee.text() === "SecurePair") isExact = true;
    }
    if (!isExact) continue;

    let newConstructorName = "TLSSocket";
    if (callee.kind() === "member_expression") {
      const object = callee.field("object");
      if (object) {
        newConstructorName = `${object.text()}.TLSSocket`;
      }
    }

    // Replace the constructor call with `new TLSSocket(socket)`.
    edits.push(node.replace(`new ${newConstructorName}(socket)`));
    const declarator = getClosest(node, ["variable_declarator"]);
    if (declarator) {
      const idNode = declarator.field("name");
      if (idNode) {
        const oldName = idNode.text();
        let newName = "socket";
        if (oldName !== "pair" && oldName !== "SecurePair") {
          if (oldName.includes("Pair")) newName = oldName.replace("Pair", "Socket");
          else if (oldName.includes("pair")) newName = oldName.replace("pair", "socket");
        }

        const allMemberExprs = rootNode.findAll({ rule: { kind: "member_expression" } });
        for (const usage of allMemberExprs) {
          const objectNode = usage.field("object");
          const propertyNode = usage.field("property");
          if (!objectNode || !propertyNode) continue;
          if (objectNode.text() !== oldName) continue;
          const propText = propertyNode.text();
          if (propText !== "cleartext" && propText !== "encrypted") continue;
          const statement = getClosest(usage, ["lexical_declaration", "expression_statement"]);
          if (statement) linesToRemove.push(statement.range());
        }

        // Rename the variable (e.g. `pair` -> `socket`) and update references.
        edits.push(idNode.replace(newName));
        const references = rootNode.findAll({
          rule: { kind: "identifier", pattern: oldName }
        });
        
        for (const ref of references) {
          // Ensure exact identifier match (pattern may match substrings).
          if (ref.text() !== oldName) continue;
          const parent = ref.parent();
          if (!parent) continue;

          const parentKind = parent.kind();
          if (parentKind === "member_expression") {
            const property = parent.field("property");
            if (property && property.id() === ref.id()) continue;
          }
          if (parentKind === "import_specifier" || parentKind === "shorthand_property_identifier_pattern") continue;
          if (ref.id() === idNode.id()) continue;

          edits.push(ref.replace(newName));
        }
      }
    }
  }

  const sourceCode = rootNode.commitEdits(edits);

  let output = removeLines(sourceCode, linesToRemove) ?? "";

  // Normalize newlines and trim trailing whitespace for predictable snapshots.
  output = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  output = output.replace(/(^.*\S)[ \t]+$/gm, "$1");
  output = output.replace(/^\uFEFF/, "");

  const eol = (typeof process !== 'undefined' && process.platform === 'win32') ? '\r\n' : '\n';
  output = output.replace(/\n/g, eol);
  if (output.endsWith(eol)) output = output.slice(0, -eol.length);

  return output;
}