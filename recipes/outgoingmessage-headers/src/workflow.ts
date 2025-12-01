import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

export default function transform(root: SgRoot<Js>): string | null {
  const rootNode = root.root();
  const edits: Edit[] = [];
  let hasChanges = false;

  {
    const matches = rootNode.findAll({
      rule: { pattern: "$OBJ._headers[$KEY]" },
    });
    for (const m of matches) {
      const obj = m.getMatch("OBJ");
      const key = m.getMatch("KEY");
      if (!obj || !key) continue;

      edits.push(m.replace(`${obj.text()}.getHeader(${key.text()})`));
      hasChanges = true;
    }
  }

  {
    const matches = rootNode.findAll({
      rule: { pattern: "$KEY in $OBJ._headers" },
    });
    for (const m of matches) {
      const obj = m.getMatch("OBJ");
      const key = m.getMatch("KEY");
      if (!obj || !key) continue;

      edits.push(m.replace(`${obj.text()}.hasHeader(${key.text()})`));
      hasChanges = true;
    }
  }

  {
    const matches = rootNode.findAll({
      rule: { pattern: "Object.keys($OBJ._headers)" },
    });
    for (const m of matches) {
      const obj = m.getMatch("OBJ");
      if (!obj) continue;

      edits.push(m.replace(`${obj.text()}.getHeaderNames()`));
      hasChanges = true;
    }
  }

  {
    const matches = rootNode.findAll({
      rule: { pattern: "$OBJ._headerNames" },
    });
    for (const m of matches) {
      const obj = m.getMatch("OBJ");
      if (!obj) continue;

      edits.push(m.replace(`${obj.text()}.getHeaderNames()`));
      hasChanges = true;
    }
  }

  {
    const matches = rootNode.findAll({
      rule: { pattern: "$OBJ._headers" },
    });
    for (const m of matches) {
      const obj = m.getMatch("OBJ");
      if (!obj) continue;

      const text = m.text();
      if (text.includes("[")) continue;

      const parent = m.parent();
      const parentText = parent?.text() ?? "";

      if (parentText.startsWith("Object.keys(")) continue;

      if (parentText.includes("=") && parentText.trim().startsWith(obj.text())) {
        continue;
      }

      edits.push(m.replace(`${obj.text()}.getHeaders()`));
      hasChanges = true;
    }
  }

  if (!hasChanges) return null;
  return rootNode.commitEdits(edits);
}
