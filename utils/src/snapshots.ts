import { basename, dirname, extname, join } from 'node:path';
import { snapshot } from 'node:test';

snapshot.setResolveSnapshotPath(generateSnapshotPath);

/**
 * @param {string} testFilePath `'/tmp/foo.test.js'`
 * @returns `'/tmp/foo.test.snap.cjs'`
 * @type {Parameters<snapshot.setResolveSnapshotPath>[0]}
 */
function generateSnapshotPath(testFilePath) {
	if (!testFilePath) return '';

	const ext = extname(testFilePath);
	const filename = basename(testFilePath, ext);
	const base = dirname(testFilePath);

	return join(base, `${filename}.snap.cjs`);
}
