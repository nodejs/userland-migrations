import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
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

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'dep-manager-test-'));
		process.chdir(tempDir);
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('should work with npm', { skip: !haveNpmOnMachine() }, () => {
		execSync('npm init -y', { stdio: 'ignore', cwd: tempDir });

		installDependency(PACKAGE_NAME);

		const detectedManager = detectPackageManager();
		assert.strictEqual(detectedManager, 'npm');

		installDependency(PACKAGE_NAME, false, 'ignore');

		const packageJsonPath = join(tempDir, 'package.json');
		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

		assert(
			packageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should be in dependencies`,
		);

		removeDependency(PACKAGE_NAME, 'ignore');

		const updatedPackageJson = JSON.parse(
			readFileSync(packageJsonPath, 'utf-8'),
		);
		assert(
			!updatedPackageJson.dependencies ||
				!updatedPackageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should not be in dependencies`,
		);
	});

	it('should work with yarn', { skip: !haveYarnOnMachine() }, () => {
		execSync('yarn init -y', { stdio: 'ignore', cwd: tempDir });

		installDependency(PACKAGE_NAME, false, 'ignore');

		const detectedManager = detectPackageManager();
		assert.strictEqual(detectedManager, 'yarn');

		const packageJsonPath = join(tempDir, 'package.json');
		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

		assert(
			packageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should be in dependencies`,
		);

		removeDependency(PACKAGE_NAME, 'ignore');

		const updatedPackageJson = JSON.parse(
			readFileSync(packageJsonPath, 'utf-8'),
		);
		assert(
			!updatedPackageJson.dependencies ||
				!updatedPackageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should not be in dependencies`,
		);
	});

	it('should work with pnpm', { skip: !havePnpmOnMachine() }, () => {
		execSync('pnpm init', { stdio: 'ignore', cwd: tempDir });

		// Run pnpm install to generate the pnpm-lock.yaml file
		execSync('pnpm install', { stdio: 'ignore', cwd: tempDir });

		installDependency(PACKAGE_NAME, false, 'ignore');

		const detectedManager = detectPackageManager();
		assert.strictEqual(detectedManager, 'pnpm');

		const packageJsonPath = join(tempDir, 'package.json');
		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

		assert(
			packageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should be in dependencies`,
		);

		removeDependency(PACKAGE_NAME, 'ignore');

		const updatedPackageJson = JSON.parse(
			readFileSync(packageJsonPath, 'utf-8'),
		);
		assert(
			!updatedPackageJson.dependencies ||
				!updatedPackageJson.dependencies[PACKAGE_NAME],
			`${PACKAGE_NAME} should not be in dependencies`,
		);
	});

	it('should default to npm if no lock file is present', () => {
		execSync('npm init -y', { stdio: 'ignore', cwd: tempDir });

		rmSync(join(tempDir, 'package-lock.json'), { force: true });

		const detectedManager = detectPackageManager();
		assert.strictEqual(detectedManager, 'npm');
	});
});
