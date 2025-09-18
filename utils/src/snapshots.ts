import { basename, dirname, extname, join } from 'node:path';
import { snapshot } from 'node:test';

/**
 * @param {string} testFilePath `'/tmp/foo.test.js'`
 * @returns `'/tmp/foo.test.snap.cjs'`
 */
const generateSnapshotPath: Parameters<
	typeof snapshot.setResolveSnapshotPath
>[0] = (testFilePath) => {
	if (!testFilePath) return '';

	const ext = extname(testFilePath);
	const filename = basename(testFilePath, ext);
	const base = dirname(testFilePath);

	return join(base, `${filename}.snap.cjs`);
};

snapshot.setResolveSnapshotPath(generateSnapshotPath);
