import process from 'node:process';

type LogMsg = string;
type LogType = 'error' | 'log' | 'warn';
type FileLog = { msg: LogMsg; type: LogType };
type Source = URL['pathname'];

/**
 * Collect log entries and report them at the end, collated by source module.
 */
export const logger = (source: Source, type: LogType, msg: LogMsg) => {
	const fileLog = new Set<FileLog>(logs.has(source) ? logs.get(source) : []);

	fileLog.add({ msg, type });
	logs.set(source, fileLog);
};

/**
 * @type {Map<URL['pathname'], Set<Record<LogMsg, LogType>>>}
 */
const logs = new Map<Source, Set<FileLog>>();

process.once('beforeExit', emitLogs);

function emitLogs() {
	let hasError = false;

	for (const [sourceFile, fileLog] of logs.entries()) {
		console.log('[Codemod: correct-ts-specifiers]:', sourceFile);
		for (const { msg, type } of fileLog) {
			console[type](' •', msg);
			if (type === 'error') hasError = true;
		}
	}

	if (hasError) {
		console.error('[Codemod: correct-ts-specifiers]: migration incomplete!');
		process.exitCode = 1;
	} else {
		process.exitCode = 0;
		console.log('[Codemod: correct-ts-specifiers]: migration complete!');
	}
}
