import { basename, dirname, extname, join } from 'node:path';
import { snapshot } from 'node:test';


snapshot.setResolveSnapshotPath(generateSnapshotPath);
/**
 * @param testFilePath '/tmp/foo.test.js'
 * @returns '/tmp/foo.test.snap.cjs'
 */
function generateSnapshotPath(testFilePath?: string) {
  if (!testFilePath) return '';

  const ext = extname(testFilePath);
  const filename = basename(testFilePath, ext);
  const base = dirname(testFilePath);

  return join(base, `${filename}.snap.cjs`);
}
