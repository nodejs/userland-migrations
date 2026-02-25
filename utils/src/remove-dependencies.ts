/**
 * Important notes, this utility is designed to be used in JSSG context so we use specific APIs avaible in that context. https://github.com/awslabs/llrt/blob/main/API.md
 */
import { spawn } from 'node:child_process';
import { accessSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type RemoveDependenciesOptions = {
	packageJsonPath?: string;
	runInstall?: boolean;
	persistFileWrite?: boolean;
};

/**
 * Remove specified dependencies from package.json and run appropriate package manager install
 */
export default async function removeDependencies(
	dependenciesToRemove?: string | string[],
	options: RemoveDependenciesOptions = {},
) {
	const packageJsonPath = options.packageJsonPath ?? 'package.json';
	const packageDirectory = dirname(packageJsonPath);
	const persistFileWrite = options.persistFileWrite ?? true;

	if (!dependenciesToRemove) {
		console.log('No dependencies specified for removal');
		return Promise.resolve(null);
	}

	if (
		Array.isArray(dependenciesToRemove) &&
		dependenciesToRemove.length === 0
	) {
		console.log('No dependencies specified for removal');
		return Promise.resolve(null);
	}

	if (!fileExists(packageJsonPath)) {
		console.log('No package.json found, skipping dependency removal');
		return Promise.resolve(null);
	}

	try {
		const depsToRemove = Array.isArray(dependenciesToRemove)
			? dependenciesToRemove
			: [dependenciesToRemove];

		const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
		const packageJson = JSON.parse(packageJsonContent);

		let modified = false;

		if (packageJson.dependencies) {
			for (const dep of depsToRemove) {
				if (packageJson.dependencies[dep]) {
					delete packageJson.dependencies[dep];
					modified = true;
					console.log(`Removed ${dep} from dependencies`);
				}
			}
		}

		if (packageJson.devDependencies) {
			for (const dep of depsToRemove) {
				if (packageJson.devDependencies[dep]) {
					delete packageJson.devDependencies[dep];
					modified = true;
					console.log(`Removed ${dep} from devDependencies`);
				}
			}
		}

		if (!modified) {
			console.log(
				`No specified dependencies (${depsToRemove.join(', ')}) found in package.json`,
			);
			return Promise.resolve(null);
		}

		const updatedContent = JSON.stringify(packageJson, null, 2);

		if (persistFileWrite) {
			writeFileSync(packageJsonPath, updatedContent, 'utf-8');
			console.log('Updated package.json');
		}

		if (options.runInstall !== false) {
			const packageManager = detectPackageManager(
				packageDirectory,
				packageJson,
			);
			await runPackageManagerInstall(packageManager, packageDirectory);
			return updatedContent;
		}

		return updatedContent;
	} catch (error) {
		console.error('Error removing dependencies:', error);
		return null;
	}
}

/**
 * Detect which package manager is being used based on package.json packageManager,
 * then lock files. Defaults to npm.
 */
function detectPackageManager(
	packageDirectory: string,
	packageJson?: { packageManager?: string },
): 'npm' | 'yarn' | 'pnpm' {
	const pManager = packageJson.packageManager?.match(/npm|pnpm|yarn/)?.[0] as
		| 'npm'
		| 'yarn'
		| 'pnpm'
		| undefined;

	if (pManager) return pManager;
	if (fileExists(join(packageDirectory, 'pnpm-lock.yaml'))) return 'pnpm';
	if (fileExists(join(packageDirectory, 'yarn.lock'))) return 'yarn';

	return 'npm';
}

function fileExists(path: string): boolean {
	try {
		accessSync(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Run the appropriate package manager install command
 */
function runPackageManagerInstall(
	packageManager: 'npm' | 'yarn' | 'pnpm',
	packageDirectory: string,
): Promise<void> {
	console.log(`Running ${packageManager} install to update dependencies...`);

	return new Promise((resolve) => {
		const child = spawn(packageManager, ['install'], {
			cwd: packageDirectory,
			stdio: 'inherit',
		});

		let settled = false;
		const settle = () => {
			if (!settled) {
				settled = true;
				resolve();
			}
		};

		child.on('error', (error) => {
			console.error(`Error running ${packageManager} install:`, error);
			settle();
		});

		child.on('close', (code) => {
			if (code === 0) {
				console.log(`Successfully updated dependencies with ${packageManager}`);
			} else {
				console.error(`${packageManager} install exited with code ${code}`);
			}

			settle();
		});
	});
}
