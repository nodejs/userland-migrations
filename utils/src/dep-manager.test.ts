import { execSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { spawnPromisified } from './spawn-promisified.ts';
import {
	detectPackageManager,
	installDependency,
	removeDependency,
} from './dep-manager.ts';

const PACKAGE_NAME = '@augustinmauroy/vec3';

const haveNpmOnMachine = (): boolean => {
	try {
		execSync('npm --version', { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
};

const haveYarnOnMachine = (): boolean => {
	try {
		execSync('yarn --version', { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
};

const havePnpmOnMachine = (): boolean => {
	try {
		execSync('pnpm --version', { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
};

describe('dep-manager utilities', () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'dep-manager-test-'));
		process.chdir(tempDir);
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it('should work with npm', { skip: !haveNpmOnMachine() }, async () => {
		await spawnPromisified('npm', ['init', '-y'], { cwd: tempDir });

		await installDependency(PACKAGE_NAME);

		const detectedManager = detectPackageManager();
		assert.strictEqual(detectedManager, 'npm');

		await installDependency(PACKAGE_NAME, false, 'ignore');

		const packageJsonPath = join(tempDir, 'package.json');
		const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

		assert(
			packageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should be in dependencies`,
		);

		await removeDependency(PACKAGE_NAME, 'ignore');

		const updatedPackageJson = JSON.parse(
			await readFile(packageJsonPath, 'utf-8'),
		);
		assert(
			!updatedPackageJson.dependencies ||
				!updatedPackageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should not be in dependencies`,
		);
	});

	it('should work with yarn', { skip: !haveYarnOnMachine() }, async () => {
		await spawnPromisified('yarn', ['init', '-y'], { cwd: tempDir });

		await installDependency(PACKAGE_NAME, false, 'ignore');

		const detectedManager = detectPackageManager();
		assert.strictEqual(detectedManager, 'yarn');

		const packageJsonPath = join(tempDir, 'package.json');
		const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

		assert(
			packageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should be in dependencies`,
		);

		await removeDependency(PACKAGE_NAME, 'ignore');

		const updatedPackageJson = JSON.parse(
			await readFile(packageJsonPath, 'utf-8'),
		);
		assert(
			!updatedPackageJson.dependencies ||
				!updatedPackageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should not be in dependencies`,
		);
	});

	it('should work with pnpm', { skip: !havePnpmOnMachine() }, async () => {
		await spawnPromisified('pnpm', ['init'], { cwd: tempDir });

		// Run pnpm install to generate the pnpm-lock.yaml file
		await spawnPromisified('pnpm', ['install'], { cwd: tempDir });

		await installDependency(PACKAGE_NAME, false, 'ignore');

		const detectedManager = detectPackageManager();
		assert.strictEqual(detectedManager, 'pnpm');

		const packageJsonPath = join(tempDir, 'package.json');
		const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

		assert(
			packageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should be in dependencies`,
		);

		await removeDependency(PACKAGE_NAME, 'ignore');

		const updatedPackageJson = JSON.parse(
			await readFile(packageJsonPath, 'utf-8'),
		);
		assert(
			!updatedPackageJson.dependencies ||
				!updatedPackageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should not be in dependencies`,
		);
	});

	it('should default to npm if no lock file is present', async () => {
		await spawnPromisified('npm', ['init', '-y'], { cwd: tempDir });

		await rm(join(tempDir, 'package-lock.json'), { force: true });

		const detectedManager = detectPackageManager();
		assert.strictEqual(detectedManager, 'npm');
	});
});
