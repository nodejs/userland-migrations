import { spawn } from 'node:child_process';

export function spawnPromisified(...args: Parameters<typeof spawn>) {
	let stderr = '';
	let stdout = '';

	const child = spawn(...args);
	child.stderr?.setEncoding('utf8');
	child.stderr?.on('data', (data) => {
		stderr += data;
	});
	child.stdout?.setEncoding('utf8');
	child.stdout?.on('data', (data) => {
		stdout += data;
	});

	return new Promise<{
		code: number | null;
		signal: NodeJS.Signals | null;
		stderr: string;
		stdout: string;
	}>((resolve, reject) => {
		child.on('close', (code, signal) => {
			resolve({
				code,
				signal,
				stderr,
				stdout,
			});
		});
		child.on('error', (err: Error) => {
			reject({
				error: err,
				stderr,
				stdout,
			});
		});
	});
}
