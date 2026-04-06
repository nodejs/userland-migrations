import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';

import removeDependencies from './remove-dependencies.ts';

describe('removeDependencies', () => {
	it('should return null when no dependencies are specified', async () => {
		const result = await removeDependencies();
		assert.strictEqual(result, null);
	});

	it('should return null when empty array is provided', async () => {
		const result = await removeDependencies([]);
		assert.strictEqual(result, null);
	});

	it('should return null when package.json does not exist in current directory', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const originalCwd = process.cwd();

		try {
			process.chdir(tempDir);
			const result = await removeDependencies('chalk', { runInstall: false });
			assert.strictEqual(result, null);
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should handle package.json with no dependencies sections', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const originalCwd = process.cwd();

		const packageJsonContent = {
			name: 'test-package',
			version: '1.0.0',
		};

		try {
			process.chdir(tempDir);
			await writeFile(
				'package.json',
				JSON.stringify(packageJsonContent, null, 2),
			);

			const result = await removeDependencies('chalk', { runInstall: false });

			assert.strictEqual(result, null);
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should remove a single dependency from dependencies', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const originalCwd = process.cwd();

		const packageJsonContent = {
			name: 'test-package',
			version: '1.0.0',
			dependencies: {
				chalk: '^4.0.0',
				lodash: '^4.17.21',
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile(
				'package.json',
				JSON.stringify(packageJsonContent, null, 2),
			);

			await removeDependencies('chalk', { runInstall: false });

			const updatedContent = readFileSync('package.json', 'utf-8');
			const updatedPackageJson = JSON.parse(updatedContent);

			assert.strictEqual(updatedPackageJson.dependencies.chalk, undefined);
			assert.strictEqual(updatedPackageJson.dependencies.lodash, '^4.17.21');
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should remove multiple dependencies from both dependencies and devDependencies', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const originalCwd = process.cwd();

		const packageJsonContent = {
			name: 'test-package',
			version: '1.0.0',
			dependencies: {
				chalk: '^4.0.0',
				lodash: '^4.17.21',
			},
			devDependencies: {
				jest: '^29.0.0',
				typescript: '^5.0.0',
				chalk: '^4.0.0',
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile(
				'package.json',
				JSON.stringify(packageJsonContent, null, 2),
			);

			await removeDependencies(['chalk', 'jest'], { runInstall: false });

			const updatedContent = readFileSync('package.json', 'utf-8');
			const updatedPackageJson = JSON.parse(updatedContent);

			assert.strictEqual(updatedPackageJson.dependencies.chalk, undefined);
			assert.strictEqual(updatedPackageJson.dependencies.lodash, '^4.17.21');
			assert.strictEqual(updatedPackageJson.devDependencies.chalk, undefined);
			assert.strictEqual(updatedPackageJson.devDependencies.jest, undefined);
			assert.strictEqual(
				updatedPackageJson.devDependencies.typescript,
				'^5.0.0',
			);
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should return null when no specified dependencies are found', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const originalCwd = process.cwd();

		const packageJsonContent = {
			name: 'test-package',
			version: '1.0.0',
			dependencies: {
				lodash: '^4.17.21',
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile(
				'package.json',
				JSON.stringify(packageJsonContent, null, 2),
			);

			const result = await removeDependencies(['chalk', 'jest'], {
				runInstall: false,
			});

			assert.strictEqual(result, null);
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should prioritize packageManager over lock files when running install', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const binDir = join(tempDir, 'bin');
		const originalCwd = process.cwd();
		const originalPath = process.env.PATH;

		const packageJsonContent = {
			name: 'test-package',
			version: '1.0.0',
			packageManager: 'yarn@4.42.0',
			dependencies: {
				chalk: '^4.0.0',
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile(
				'package.json',
				JSON.stringify(packageJsonContent, null, 2),
			);
			await writeFile('pnpm-lock.yaml', 'lockfileVersion: 9');

			await mkdir(binDir);
			await writeFile(
				join(binDir, 'npm'),
				`#!/bin/sh\necho npm > "${join(tempDir, 'pm-used.txt')}"\n`,
			);
			await writeFile(
				join(binDir, 'pnpm'),
				`#!/bin/sh\necho pnpm > "${join(tempDir, 'pm-used.txt')}"\n`,
			);
			await writeFile(
				join(binDir, 'yarn'),
				`#!/bin/sh\necho yarn > "${join(tempDir, 'pm-used.txt')}"\n`,
			);

			await chmod(join(binDir, 'npm'), 0o755);
			await chmod(join(binDir, 'pnpm'), 0o755);
			await chmod(join(binDir, 'yarn'), 0o755);

			process.env.PATH = `${binDir}:${originalPath ?? ''}`;

			await removeDependencies('chalk', { runInstall: true });

			const packageManagerUsed = readFileSync(join(tempDir, 'pm-used.txt'), 'utf-8').trim();
			assert.strictEqual(packageManagerUsed, 'yarn');
		} finally {
			process.env.PATH = originalPath;
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should return updated content without writing file when persistFileWrite is false', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const originalCwd = process.cwd();

		const packageJsonContent = {
			name: 'test-package',
			version: '1.0.0',
			dependencies: {
				chalk: '^4.0.0',
				lodash: '^4.17.21',
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile(
				'package.json',
				JSON.stringify(packageJsonContent, null, 2),
			);

			const result = await removeDependencies('chalk', {
				runInstall: false,
				persistFileWrite: false,
			});

			assert.notStrictEqual(result, null);

			const resultPackageJson = JSON.parse(result ?? '{}');
			assert.strictEqual(resultPackageJson.dependencies.chalk, undefined);

			const diskPackageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
			assert.strictEqual(diskPackageJson.dependencies.chalk, '^4.0.0');
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should return null when package.json content is invalid', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const originalCwd = process.cwd();

		try {
			process.chdir(tempDir);
			await writeFile('package.json', '{ invalid json');

			const result = await removeDependencies('chalk', { runInstall: false });
			assert.strictEqual(result, null);
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should fallback to pnpm lock file when packageManager is unsupported', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const binDir = join(tempDir, 'bin');
		const originalCwd = process.cwd();
		const originalPath = process.env.PATH;

		const packageJsonContent = {
			name: 'test-package',
			version: '1.0.0',
			packageManager: 'other@1.0.0',
			dependencies: {
				chalk: '^4.0.0',
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile(
				'package.json',
				JSON.stringify(packageJsonContent, null, 2),
			);
			await writeFile('pnpm-lock.yaml', 'lockfileVersion: 9');

			await mkdir(binDir);
			await writeFile(
				join(binDir, 'npm'),
				`#!/bin/sh\necho npm > "${join(tempDir, 'pm-used.txt')}"\n`,
			);
			await writeFile(
				join(binDir, 'pnpm'),
				`#!/bin/sh\necho pnpm > "${join(tempDir, 'pm-used.txt')}"\n`,
			);
			await writeFile(
				join(binDir, 'yarn'),
				`#!/bin/sh\necho yarn > "${join(tempDir, 'pm-used.txt')}"\n`,
			);

			await chmod(join(binDir, 'npm'), 0o755);
			await chmod(join(binDir, 'pnpm'), 0o755);
			await chmod(join(binDir, 'yarn'), 0o755);

			process.env.PATH = `${binDir}:${originalPath ?? ''}`;

			await removeDependencies('chalk', { runInstall: true });

			const packageManagerUsed = readFileSync(join(tempDir, 'pm-used.txt'), 'utf-8').trim();
			assert.strictEqual(packageManagerUsed, 'pnpm');
		} finally {
			process.env.PATH = originalPath;
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should fallback to yarn lock file when packageManager is missing', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const binDir = join(tempDir, 'bin');
		const originalCwd = process.cwd();
		const originalPath = process.env.PATH;

		const packageJsonContent = {
			name: 'test-package',
			version: '1.0.0',
			dependencies: {
				chalk: '^4.0.0',
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile(
				'package.json',
				JSON.stringify(packageJsonContent, null, 2),
			);
			await writeFile('yarn.lock', '# yarn lockfile');

			await mkdir(binDir);
			await writeFile(
				join(binDir, 'npm'),
				`#!/bin/sh\necho npm > "${join(tempDir, 'pm-used.txt')}"\n`,
			);
			await writeFile(
				join(binDir, 'pnpm'),
				`#!/bin/sh\necho pnpm > "${join(tempDir, 'pm-used.txt')}"\n`,
			);
			await writeFile(
				join(binDir, 'yarn'),
				`#!/bin/sh\necho yarn > "${join(tempDir, 'pm-used.txt')}"\n`,
			);

			await chmod(join(binDir, 'npm'), 0o755);
			await chmod(join(binDir, 'pnpm'), 0o755);
			await chmod(join(binDir, 'yarn'), 0o755);

			process.env.PATH = `${binDir}:${originalPath ?? ''}`;

			await removeDependencies('chalk', { runInstall: true });

			const packageManagerUsed = readFileSync(join(tempDir, 'pm-used.txt'), 'utf-8').trim();
			assert.strictEqual(packageManagerUsed, 'yarn');
		} finally {
			process.env.PATH = originalPath;
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should fallback to npm when packageManager is missing and no lock files exist', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const binDir = join(tempDir, 'bin');
		const originalCwd = process.cwd();
		const originalPath = process.env.PATH;

		const packageJsonContent = {
			name: 'test-package',
			version: '1.0.0',
			dependencies: {
				chalk: '^4.0.0',
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile(
				'package.json',
				JSON.stringify(packageJsonContent, null, 2),
			);

			await mkdir(binDir);
			await writeFile(
				join(binDir, 'npm'),
				`#!/bin/sh\necho npm > "${join(tempDir, 'pm-used.txt')}"\n`,
			);
			await writeFile(
				join(binDir, 'pnpm'),
				`#!/bin/sh\necho pnpm > "${join(tempDir, 'pm-used.txt')}"\n`,
			);
			await writeFile(
				join(binDir, 'yarn'),
				`#!/bin/sh\necho yarn > "${join(tempDir, 'pm-used.txt')}"\n`,
			);

			await chmod(join(binDir, 'npm'), 0o755);
			await chmod(join(binDir, 'pnpm'), 0o755);
			await chmod(join(binDir, 'yarn'), 0o755);

			process.env.PATH = `${binDir}:${originalPath ?? ''}`;

			await removeDependencies('chalk', { runInstall: true });

			const packageManagerUsed = readFileSync(join(tempDir, 'pm-used.txt'), 'utf-8').trim();
			assert.strictEqual(packageManagerUsed, 'npm');
		} finally {
			process.env.PATH = originalPath;
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should resolve when package manager binary cannot be spawned', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const binDir = join(tempDir, 'bin');
		const originalCwd = process.cwd();
		const originalPath = process.env.PATH;

		const packageJsonContent = {
			name: 'test-package',
			version: '1.0.0',
			packageManager: 'yarn@4.42.0',
			dependencies: {
				chalk: '^4.0.0',
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile(
				'package.json',
				JSON.stringify(packageJsonContent, null, 2),
			);

			await mkdir(binDir);
			await writeFile(
				join(binDir, 'npm'),
				'#!/bin/sh\nexit 0\n',
			);
			await writeFile(
				join(binDir, 'pnpm'),
				'#!/bin/sh\nexit 0\n',
			);

			await chmod(join(binDir, 'npm'), 0o755);
			await chmod(join(binDir, 'pnpm'), 0o755);

			process.env.PATH = binDir;

			const result = await removeDependencies('chalk', { runInstall: true });
			assert.notStrictEqual(result, null);
		} finally {
			process.env.PATH = originalPath;
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});

	it('should resolve when package manager exits with non-zero code', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'remove-deps-test-'));
		const binDir = join(tempDir, 'bin');
		const originalCwd = process.cwd();
		const originalPath = process.env.PATH;

		const packageJsonContent = {
			name: 'test-package',
			version: '1.0.0',
			packageManager: 'yarn@4.42.0',
			dependencies: {
				chalk: '^4.0.0',
			},
		};

		try {
			process.chdir(tempDir);
			await writeFile(
				'package.json',
				JSON.stringify(packageJsonContent, null, 2),
			);

			await mkdir(binDir);
			await writeFile(
				join(binDir, 'yarn'),
				'#!/bin/sh\nexit 1\n',
			);
			await chmod(join(binDir, 'yarn'), 0o755);

			process.env.PATH = `${binDir}:${originalPath ?? ''}`;

			const result = await removeDependencies('chalk', { runInstall: true });
			assert.notStrictEqual(result, null);
		} finally {
			process.env.PATH = originalPath;
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true });
		}
	});
});
