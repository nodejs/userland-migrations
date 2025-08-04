import type { Edit, SgRoot } from "@codemod.com/jssg-types/main";
import { getNodeRequireCalls } from "@nodejs/codemod-utils/ast-grep/require-call";
import { getNodeImportStatements } from "@nodejs/codemod-utils/ast-grep/import-statement";

export default function tranform(root: SgRoot): string | null {
  const rootNode = root.root();
  const edits: Edit[] = [];
  let hasChanges = false;
  let hasImportChanges = false;
  let hasPromisesImport = false;
  let promisesImportName = "promises";

  // @ts-ignore - ast-grep types are not fully compatible with JSSG types
  const requireStatements = getNodeRequireCalls(root, "fs");

  for (const statement of requireStatements) {
    const objectPattern = statement.find({
      rule: {
        kind: "object_pattern"
      }
    });
    if (objectPattern) {
      let originalText = objectPattern.text();

      if (originalText.includes("F_OK")) {
        const newText = originalText.replace(/\bF_OK\b/g, "constants")
        edits.push(objectPattern.replace(newText));
        hasChanges = true;
        originalText = newText;
      }

      if (originalText.includes("R_OK")) {
        let newText = "";
        if (hasChanges) {
          newText = originalText.replace(/\bR_OK\b/g, "")
        } else {
          newText = originalText.replace(/\bR_OK\b/g, "constants")
        }
        edits.pop();
        edits.push(objectPattern.replace(newText));
        hasChanges = true;
        originalText = newText;
      }

      if (originalText.includes("W_OK")) {
        let newText = "";
        if (hasChanges) {
          newText = originalText.replace(/\bW_OK\b/g, "")
        } else {
          newText = originalText.replace(/\bW_OK\b/g, "constants")
        }
        edits.pop();
        edits.push(objectPattern.replace(newText));
        hasChanges = true;
        originalText = newText;
      }

      if (originalText.includes("X_OK")) {
        let newText = "";
        if (hasChanges) {
          newText = originalText.replace(/\bX_OK\b/g, "")
        } else {
          newText = originalText.replace(/\bX_OK\b/g, "constants")
        }
        edits.pop();
        edits.push(objectPattern.replace(newText));
        hasChanges = true;
        originalText = newText;
      }

      if (originalText.includes(", }") || originalText.includes(",  ") || originalText.includes(" , ")) {
        const newText = originalText.replace(" , ", "").replace(",,", ",").replace(",  ", ", ").replace(", }", " }");
        edits.pop();
        edits.push(objectPattern.replace(newText));
        hasChanges = true;
        originalText = newText;
      }
    }
  }

  // @ts-ignore - ast-grep types are not fully compatible with JSSG types
  const importStatements = getNodeImportStatements(root, "fs");

  for (const statement of importStatements) {
    const namedImports = statement.find({
      rule: {
        kind: "named_imports"
      }
    });

    if (namedImports) {
      let originalText = namedImports.text();
      hasPromisesImport = originalText.includes("promises");
      if (hasPromisesImport && originalText.includes("promises as")) {
        const m = originalText.matchAll((/promises as (\w+)/g));
        m.forEach((v) => promisesImportName = v[1] ?? promisesImportName);
      }

      if (originalText.includes("F_OK")) {
        let newText = "";
        if (hasPromisesImport) {
          newText = originalText.replace(/\bF_OK\b/g, "")
        } else {
          newText = originalText.replace(/\bF_OK\b/g, "constants")
        }
        edits.push(namedImports.replace(newText));
        hasChanges = true;
        hasImportChanges = true;
        originalText = newText;
      }

      if (originalText.includes("R_OK")) {
        let newText = "";
        if (hasImportChanges || hasPromisesImport) {
          newText = originalText.replace(/\bR_OK\b/g, "")
        } else {
          newText = originalText.replace(/\bR_OK\b/g, "constants")
        }
        edits.pop();
        edits.push(namedImports.replace(newText));
        hasChanges = true;
        hasImportChanges = true;
        originalText = newText;
      }

      if (originalText.includes("W_OK")) {
        let newText = "";
        if (hasImportChanges || hasPromisesImport) {
          newText = originalText.replace(/\bW_OK\b/g, "")
        } else {
          newText = originalText.replace(/\bW_OK\b/g, "constants")
        }
        edits.pop();
        edits.push(namedImports.replace(newText));
        hasChanges = true;
        hasImportChanges = true;
        originalText = newText;
      }

      if (originalText.includes("X_OK")) {
        let newText = "";
        if (hasImportChanges || hasPromisesImport) {
          newText = originalText.replace(/\bX_OK\b/g, "")
        } else {
          newText = originalText.replace(/\bX_OK\b/g, "constants")
        }
        edits.pop();
        edits.push(namedImports.replace(newText));
        hasChanges = true;
        hasImportChanges = true;
        originalText = newText;
      }

      if (originalText.includes(", }") || originalText.includes(",  ") || originalText.includes(" , ")) {
        const newText = originalText.replace(" , ", "").replace(",,", ",").replace(",  ", ", ").replace(", }", " }");
        edits.pop();
        edits.push(namedImports.replace(newText));
        hasChanges = true;
        originalText = newText;
      }
    }
  }

  // fs. calls

  const fs_F_OK_calls = rootNode.findAll({
    rule: {
      pattern: "fs.F_OK"
    }
  });

  for (const call of fs_F_OK_calls) {
    edits.push(call.replace("fs.constants.F_OK"))

    hasChanges = true;
  }

  const fs_R_OK_calls = rootNode.findAll({
    rule: {
      pattern: "fs.R_OK"
    }
  });

  for (const call of fs_R_OK_calls) {
    edits.push(call.replace("fs.constants.R_OK"))

    hasChanges = true;
  }

  const fs_W_OK_calls = rootNode.findAll({
    rule: {
      pattern: "fs.W_OK"
    }
  });

  for (const call of fs_W_OK_calls) {
    edits.push(call.replace("fs.constants.W_OK"))

    hasChanges = true;
  }

  const fs_X_OK_calls = rootNode.findAll({
    rule: {
      pattern: "fs.X_OK"
    }
  });

  for (const call of fs_X_OK_calls) {
    edits.push(call.replace("fs.constants.X_OK"))

    hasChanges = true;
  }

  // namespace require calls

  const F_OK_calls = rootNode.findAll({
    rule: {
      pattern: "F_OK"
    }
  });

  for (const call of F_OK_calls) {
    if (hasPromisesImport) {
      edits.push(call.replace(`${promisesImportName}.constants.F_OK`))
    } else {
      edits.push(call.replace("constants.F_OK"))
    }

    hasChanges = true;
  }

  const R_OK_calls = rootNode.findAll({
    rule: {
      pattern: "R_OK"
    }
  });

  for (const call of R_OK_calls) {
    if (hasPromisesImport) {
      edits.push(call.replace(`${promisesImportName}.constants.R_OK`))
    } else {
      edits.push(call.replace("constants.R_OK"))
    }

    hasChanges = true;
  }

  const W_OK_calls = rootNode.findAll({
    rule: {
      pattern: "W_OK"
    }
  });

  for (const call of W_OK_calls) {
    if (hasPromisesImport) {
      edits.push(call.replace(`${promisesImportName}.constants.W_OK`))
    } else {
      edits.push(call.replace("constants.W_OK"))
    }

    hasChanges = true;
  }

  const X_OK_calls = rootNode.findAll({
    rule: {
      pattern: "X_OK"
    }
  });

  for (const call of X_OK_calls) {
    if (hasPromisesImport) {
      edits.push(call.replace(`${promisesImportName}.constants.X_OK`))
    } else {
      edits.push(call.replace("constants.X_OK"))
    }

    hasChanges = true;
  }

  if (!hasChanges) return null;

  return rootNode.commitEdits(edits);
}