/**
 * @fileoverview these utilties need codemod capabilities https://docs.codemod.com/jssg/security
 */
import { accessSync } from 'node:fs';
import { execSync } from 'node:child_process';

export const detectPackageManager = (): 'npm' | 'yarn' | 'pnpm' => {
	try {
		accessSync('yarn.lock');
		return 'yarn';
	} catch {}

	try {
		accessSync('pnpm-lock.yaml');
		return 'pnpm';
	} catch {}

	return 'npm';
};

export const installDependency = (
	dependency: string,
	isDevDependency = false,
): void => {
	const packageManager = detectPackageManager();
	let command = '';

	switch (packageManager) {
		case 'npm':
			command = `npm install ${isDevDependency ? '--save-dev' : '--save'} ${dependency}`;
			break;
		case 'yarn':
			command = `yarn add ${isDevDependency ? '--dev' : ''} ${dependency}`;
			break;
		case 'pnpm':
			command = `pnpm add ${isDevDependency ? '--save-dev' : '--save'} ${dependency}`;
			break;
	}

	execSync(command, { stdio: 'inherit' });
};
