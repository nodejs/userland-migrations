import { removeLines } from "@nodejs/codemod-utils/ast-grep/remove-lines";
import type { Edit, SgRoot, Range } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

function getClosest(node: any, kinds: string[]): any | null {
  let current = node.parent();
 
  while (current) {
    if (kinds.includes(current.kind())) {
      return current;
    }
    current = current.parent();
  }
 
  return null;
}

export default function transform(root: SgRoot<Js>): string | null {
  const rootNode = root.root();
  const edits: Edit[] = [];
  const linesToRemove: Range[] = [];

  const importNodes = rootNode.findAll({
    rule: {
      any: [
        { kind: "import_specifier", has: { kind: "identifier", regex: "^SecurePair$" } },
        { kind: "shorthand_property_identifier_pattern", regex: "^SecurePair$" },
        { kind: "property_identifier", regex: "^SecurePair$" }
      ]
    }
  });

  for (const node of importNodes) {
      if (node.text() === "SecurePair") {
         edits.push(node.replace("TLSSocket"));
      }
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
            if (oldName.includes("Pair")) {
                newName = oldName.replace("Pair", "Socket");
            } 
            else if (oldName.includes("pair")) {
                newName = oldName.replace("pair", "socket");
            } 
            else {
                newName = "socket"; 
            }
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
            const statement = getClosest(usage, ["lexical_declaration", "expression_statement"]);
            if (statement) {
                linesToRemove.push(statement.range());
            }
        }

        edits.push(idNode.replace(newName));

        const references = rootNode.findAll({
            rule: {
                kind: "identifier",
                regex: `^${oldName}$`
            }
        });

        for (const ref of references) {
            const parent = ref.parent();
            if (parent && parent.kind() === 'member_expression') {
                const property = parent.field('property');
                if (property && property.id() === ref.id()) {
                    continue;
                }
            }
            
            if (parent && (parent.kind() === 'import_specifier' || parent.kind() === 'shorthand_property_identifier_pattern')) {
                 continue;
            }

            if (ref.id() === idNode.id()) continue;

            edits.push(ref.replace(newName));
        }
      }
    }
  }

  let sourceCode = rootNode.commitEdits(edits);
  sourceCode = removeLines(sourceCode, linesToRemove);
  return sourceCode;
}