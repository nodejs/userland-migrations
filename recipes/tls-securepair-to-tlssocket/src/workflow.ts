
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { resolveBindingPath } from "@nodejs/codemod-utils/ast-grep/resolve-binding-path";
import { updateBinding } from "@nodejs/codemod-utils/ast-grep/update-binding";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import type { Edit, SgRoot, Range, SgNode } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

// Utility: get closest ancestor of a node of a given kind
function getClosest(node: SgNode<Js>, kinds: string[]): SgNode<Js> | null {
  let current = node.parent();
  while (current) {
    if (kinds.includes(current.kind())) return current;
    current = current.parent();
  }
  return null;
}

export default function transform(root: SgRoot<Js>): string | null {
  const rootNode = root.root();
  const edits: Edit[] = [];
  const linesToRemove: Range[] = [];

  // Replace SecurePair in imports/requires using codemod-utils
  const importNodes = [
    ...getNodeImportStatements(root, "tls"),
    ...getNodeRequireCalls(root, "tls")
  ];
  for (const node of importNodes) {
    // Replace destructured { SecurePair } with { TLSSocket }
    const change = updateBinding(node, { old: "SecurePair", new: "TLSSocket" });
    if (change?.edit) edits.push(change.edit);
    if (change?.lineToRemove) linesToRemove.push(change.lineToRemove);
  }

  const newExpressions = rootNode.findAll({
    rule: {
      kind: "new_expression",
      has: {
        any: [
          { kind: "member_expression", has: { field: "property", regex: "^SecurePair$" } },
          { kind: "identifier", regex: "^SecurePair$" }
        ]
      }
    }
  });

  for (const node of newExpressions) {
    const callee = node.field("constructor");
    if (!callee) continue;

    let newConstructorName = "TLSSocket";
    if (callee.kind() === "member_expression") {
        const object = callee.field("object");
        if (object) {
            newConstructorName = `${object.text()}.TLSSocket`;
        }
    }

    edits.push(node.replace(`new ${newConstructorName}(socket)`));

    // Find the variable declarator for the new SecurePair
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

        // Remove usages like pair.cleartext or pair.encrypted
        const obsoleteUsages = rootNode.findAll({
          rule: {
            kind: "member_expression",
            all: [
              { has: { field: "object", regex: `^${oldName}$` } },
              { has: { field: "property", regex: "^(cleartext|encrypted)$" } }
            ]
          }
        });
        for (const usage of obsoleteUsages) {
          // Remove the whole statement, and also comments/blank lines above
          let statement = getClosest(usage, ["lexical_declaration", "expression_statement"]);
          if (statement) linesToRemove.push(statement.range());
        }

        edits.push(idNode.replace(newName));

        // Replace all other references to the old variable name
        const references = rootNode.findAll({
          rule: { kind: "identifier", regex: `^${oldName}$` }
        });
        for (const ref of references) {
          const parent = ref.parent();
          if (parent && parent.kind() === "member_expression") {
            const property = parent.field("property");
            if (property && property.id() === ref.id()) continue;
          }
          if (parent && (parent.kind() === "import_specifier" || parent.kind() === "shorthand_property_identifier_pattern")) continue;
          if (ref.id() === idNode.id()) continue;
          edits.push(ref.replace(newName));
        }
      }
    }
  }

  let sourceCode = rootNode.commitEdits(edits);
  // Remove lines, including comments/blank lines above
  sourceCode = removeLines(sourceCode, linesToRemove);
  return sourceCode;
}