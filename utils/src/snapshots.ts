import { basename, dirname, extname, join } from 'node:path';
import { snapshot } from 'node:test';

snapshot.setResolveSnapshotPath(generateSnapshotPath);

type SnapshotPath = Parameters<Parameters<typeof snapshot.setResolveSnapshotPath>[0]>[0];

/**
 * @param {string} testFilePath `'/tmp/foo.test.js'`
 * @returns `'/tmp/foo.test.snap.cjs'`
 */
function generateSnapshotPath(testFilePath: SnapshotPath) {
	if (!testFilePath) return '';

	const ext = extname(testFilePath);
	const filename = basename(testFilePath, ext);
	const base = dirname(testFilePath);

	return join(base, `${filename}.snap.cjs`);
}
