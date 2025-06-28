import process from 'node:process';
import { styleText } from "node:util";

type LogLevel = "info" | "warn" | "error" | "debug";
// @types/node:utils didn't re-export that
type LogColor = "cyan" | "yellow" | "red" | "magenta";
type LogMsg = string;
type LogType = 'error' | 'log' | 'warn' | 'info' | 'debug';
type FileLog = { msg: LogMsg; type: LogType };
type Source = URL['pathname'];

const LOGLEVELS: Record<LogLevel, number> = {
	error: 0,
	warn: 1,
	info: 2,
	debug: 3,
};

const currentLogLevel = LOGLEVELS[process.env.LOGLEVEL as LogLevel] ?? LOGLEVELS.info;

/**
 * @type {Map<URL['pathname'], Set<Record<LogMsg, LogType>>>}
 */
const logs = new Map<Source, Set<FileLog>>();
let codemodName = 'codemod';
let processExitListenerAdded = false;

/**
 * Set the codemod name for logging output
 */
export const setCodemodName = (name: string) => {
	codemodName = name;
};

/**
 * Collect log entries and report them at the end, collated by source module.
 */
export const logger = (source: Source, type: LogType, msg: LogMsg) => {
	const fileLog = new Set<FileLog>(logs.has(source) ? logs.get(source) : []);

	fileLog.add({ msg, type });
	logs.set(source, fileLog);

	// Only add the process exit listener when logger is actually used
	if (!processExitListenerAdded) {
		process.once('beforeExit', emitLogs);
		processExitListenerAdded = true;
	}
};

function createLogFunction(
	colors: Array<LogColor>,
	level: LogLevel
) {
	return (codemodName: string, ...args: unknown[]) => {
		if (LOGLEVELS[level] <= currentLogLevel) {
			const logMethod = console[level] || console.log;
			logMethod(styleText(["bold", ...colors], `[${codemodName}]`), ...args);
		}
	};
}

export const info = createLogFunction(["cyan"], "info");
export const warn = createLogFunction(["yellow"], "warn");
export const error = createLogFunction(["red"], "error");
export const debug = createLogFunction(["magenta"], "debug");

/* node:coverage disable */
// this is actually coveraged, but v8 doesn't recognise it
function emitLogs() {
	let hasError = false;

	for (const [sourceFile, fileLog] of logs.entries()) {
		console.log(`[Codemod: ${codemodName}]:`, sourceFile);
		for (const { msg, type } of fileLog) {
			console[type === 'log' ? 'log' : type](' •', msg);
			if (type === 'error') hasError = true;
		}
	}

	if (hasError) {
		console.error(`[Codemod: ${codemodName}]: migration incomplete!`);
		process.exitCode = 1;
	} else {
		process.exitCode = 0;
		console.log(`[Codemod: ${codemodName}]: migration complete!`);
	}
}
/* node:coverage enable */

const loggerWithGrouping = {
	info,
	warn,
	error,
	debug,
	logger,
	setCodemodName,
};

export default loggerWithGrouping;
