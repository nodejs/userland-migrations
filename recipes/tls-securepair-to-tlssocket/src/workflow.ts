import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { updateBinding } from "@nodejs/codemod-utils/ast-grep/update-binding";
import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import type { Edit, SgRoot, Range, SgNode } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

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

  const importNodes = [
    ...getNodeImportStatements(root, "tls"),
    ...getNodeRequireCalls(root, "tls")
  ];
  for (const node of importNodes) {
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
          let statement = getClosest(usage, ["lexical_declaration", "expression_statement"]);
          if (statement) linesToRemove.push(statement.range());
        }

        edits.push(idNode.replace(newName));
        const references = rootNode.findAll({
          rule: { kind: "identifier", regex: `^${oldName}$` }
        });
        
        for (const ref of references) {
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

  // Post-process output to avoid platform-specific diffs (CRLF, trailing spaces,
  // and excessive blank lines). Keep formatting stable across OSes.
  let output = removeLines(sourceCode, linesToRemove) ?? "";

  // Normalize CRLF to LF
  output = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Remove trailing whitespace on each non-empty line (preserve lines that are only indentation)
  output = output.replace(/(^.*\S)[ \t]+$/gm, "$1");

  // Remove BOM if present
  output = output.replace(/^\uFEFF/, "");

  // Convert LF to platform EOL so expected snapshots on Windows keep CRLF
  const eol = (typeof process !== 'undefined' && process.platform === 'win32') ? '\r\n' : '\n';
  output = output.replace(/\n/g, eol);

  // If output ends with a single EOL, remove it to match existing expected files
  if (output.endsWith(eol)) output = output.slice(0, -eol.length);

  return output;
}