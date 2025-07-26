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
 * @todo(@AugustinMauroy): use more AST than regex for this function.
 * @param param The parameter to check (e.g., 'fd').
 * @param rootNode The root node of the AST to search within.
 */
function isLikelyFileDescriptor(param: string, rootNode: SgNode<Js>): boolean {
  // Check if it's a numeric literal
  if (/^\d+$/.test(param.trim())) return true;

  // Simple check: if the parameter appears in an `openSync` assignment, it's likely a file descriptor
  const sourceText = rootNode.text();

  // Look for patterns like "const fd = openSync(...)" or "const fd = fs.openSync(...)"
  const openSyncPattern = new RegExp(`(?:const|let|var)\\s+${param}\\s*=\\s*(?:fs\\.)?openSync\\s*\\(`, 'g');

  if (openSyncPattern.test(sourceText)) return true;

  // Look for patterns where the parameter is used in an open callback
  // This handles cases like: open('file', (err, fd) => { truncate(fd, ...) })
  const callbackPattern = new RegExp(`\\(\\s*(?:err|error)\\s*,\\s*${param}\\s*\\)\\s*=>`, 'g');

	if (callbackPattern.test(sourceText)) return true;


  // Look for function callback patterns
  const functionCallbackPattern = new RegExp(`function\\s*\\(\\s*(?:err|error)\\s*,\\s*${param}\\s*\\)`, 'g');

  if (functionCallbackPattern.test(sourceText)) return true;

  // Conservative approach: if we can't determine it's a file descriptor,
  // assume it's a file path to avoid breaking valid path-based truncate calls
  return false;
}
