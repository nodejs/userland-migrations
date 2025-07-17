import type { SgRoot, Edit } from "@ast-grep/napi";

/**
 * Transform function that converts deprecated fs.rmdir calls
 * with recursive: true option to the new fs.rm API.
 *
 * Handles:
 * 1. fs.rmdir(path, { recursive: true }, callback) -> fs.rm(path, { recursive: true, force: true }, callback)
 * 2. fs.rmdir(path, { recursive: true }) -> fs.rm(path, { recursive: true, force: true })
 * 3. fs.rmdirSync(path, { recursive: true }) -> fs.rmSync(path, { recursive: true, force: true })
 * 4. fs.promises.rmdir(path, { recursive: true }) -> fs.promises.rm(path, { recursive: true, force: true })
 */
export default function transform(root: SgRoot): string | null {
  const rootNode = root.root();
  let hasChanges = false;
  const edits: Edit[] = [];

  // Find all fs.rmdir, fs.rmdirSync, and fs.promises.rmdir calls
  const rmdirCalls = rootNode.findAll({
    rule: {
      any: [
        { pattern: "fs.rmdir($PATH, $OPTIONS, $CALLBACK)" },
        { pattern: "fs.rmdir($PATH, $OPTIONS)" },
        { pattern: "fs.rmdirSync($PATH, $OPTIONS)" },
        { pattern: "fs.promises.rmdir($PATH, $OPTIONS)" }
      ]
    }
  });

  for (const call of rmdirCalls) {
    const callText = call.text();

    // Check if this call has recursive: true option
    const optionsMatch = call.getMatch("OPTIONS");
    if (!optionsMatch) continue;

    const optionsText = optionsMatch.text();
    if (!optionsText.includes("recursive") || !optionsText.includes("true")) {
      continue;
    }

    let newCallText = "";

    if (callText.includes("fs.rmdir(")) {
      // Handle fs.rmdir -> fs.rm
      if (call.getMatch("CALLBACK")) {
        // Has callback
        const path = call.getMatch("PATH")?.text();
        const callback = call.getMatch("CALLBACK")?.text();
        newCallText = `fs.rm(${path}, { recursive: true, force: true }, ${callback})`;
      } else {
        // No callback
        const path = call.getMatch("PATH")?.text();
        newCallText = `fs.rm(${path}, { recursive: true, force: true })`;
      }
    } else if (callText.includes("fs.rmdirSync(")) {
      // Handle fs.rmdirSync -> fs.rmSync
      const path = call.getMatch("PATH")?.text();
      newCallText = `fs.rmSync(${path}, { recursive: true, force: true })`;
    } else if (callText.includes("fs.promises.rmdir(")) {
      // Handle fs.promises.rmdir -> fs.promises.rm
      const path = call.getMatch("PATH")?.text();
      newCallText = `fs.promises.rm(${path}, { recursive: true, force: true })`;
    }

    if (newCallText) {
      edits.push(call.replace(newCallText));
      hasChanges = true;
    }
  }

  if (!hasChanges) return null;

  return rootNode.commitEdits(edits);
}
