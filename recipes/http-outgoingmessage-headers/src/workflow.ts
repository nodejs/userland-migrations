import type { SgRoot, Edit } from "@codemod.com/jssg-types/main";
import type Js from "@codemod.com/jssg-types/langs/javascript";

export default function transform(root: SgRoot<Js>): string | null {
  const rootNode = root.root();
  const edits: Edit[] = [];

  {
    const matches = rootNode.findAll({
      rule: { pattern: "$OBJ._headers[$KEY]" },
    });
    for (const m of matches) {
      const obj = m.getMatch("OBJ");
      const key = m.getMatch("KEY");
      if (!obj || !key) continue;

			const name = obj.text();
      if (!looksLikeOutgoingMessage(rootNode, name)) continue;

      edits.push(m.replace(`${obj.text()}.getHeader(${key.text()})`));
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

			const name = obj.text();
      if (!looksLikeOutgoingMessage(rootNode, name)) continue;

      edits.push(m.replace(`${obj.text()}.hasHeader(${key.text()})`));
    }
  }

  {
    const matches = rootNode.findAll({
      rule: { pattern: "Object.keys($OBJ._headers)" },
    });
    for (const m of matches) {
      const obj = m.getMatch("OBJ");
      if (!obj) continue;

			const name = obj.text();
      if (!looksLikeOutgoingMessage(rootNode, name)) continue;

      edits.push(m.replace(`${obj.text()}.getHeaderNames()`));
    }
  }

  {
    const matches = rootNode.findAll({
      rule: { pattern: "$OBJ._headerNames" },
    });
    for (const m of matches) {
      const obj = m.getMatch("OBJ");
      if (!obj) continue;

			const name = obj.text();
      if (!looksLikeOutgoingMessage(rootNode, name)) continue;

      edits.push(m.replace(`${obj.text()}.getHeaderNames()`));
    }
  }

  {
    const matches = rootNode.findAll({
      rule: { pattern: "$OBJ._headers" },
    });
    for (const m of matches) {
      const obj = m.getMatch("OBJ");
      if (!obj) continue;

			const name = obj.text();
      if (!looksLikeOutgoingMessage(rootNode, name)) continue;

      const text = m.text();
      if (text.includes("[")) continue;

      const parent = m.parent();
      const parentText = parent?.text() ?? "";

      if (parentText.startsWith("Object.keys(")) continue;

      if (parentText.includes("=") && parentText.trim().startsWith(obj.text())) {
        continue;
      }

      edits.push(m.replace(`${obj.text()}.getHeaders()`));
    }
  }

	if (!edits.length) return null;
  return rootNode.commitEdits(edits);
}

function looksLikeOutgoingMessage(
  file: ReturnType<SgRoot<Js>["root"]>,
  name: string
): boolean {
  const methods = [
    "setHeader",
    "getHeader",
    "getHeaders",
    "hasHeader",
    "removeHeader",
    "writeHead",
  ];
  for (const m of methods) {
    const hit = file.find({ rule: { pattern: `${name}.${m}($$)` } });
    if (hit) return true;
  }
  return false;
}
