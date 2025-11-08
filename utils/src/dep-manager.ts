/**
 * @fileoverview these utilties need codemod capabilities https://docs.codemod.com/jssg/security
 */
import { accessSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { StdioOptions } from 'node:child_process';

export const detectPackageManager = (): 'npm' | 'yarn' | 'pnpm' => {
	try {
		console.log('Checking for yarn.lock file');
		accessSync('yarn.lock');
		console.log('Detected yarn.lock file');
		return 'yarn';
	} catch {}

	try {
		accessSync('pnpm-lock.yaml');
		return 'pnpm';
	} catch {}

	return 'npm';
};

export const removeDependency = (
	dependency: string,
	stdio: StdioOptions = 'inherit',
): void => {
	const packageManager = detectPackageManager();
	let command = '';

	switch (packageManager) {
		case 'npm':
			command = `npm uninstall ${dependency}`;
			break;
		case 'yarn':
			command = `yarn remove ${dependency}`;
			break;
		case 'pnpm':
			command = `pnpm remove ${dependency}`;
			break;
	}

	execSync(command, { stdio });
};
