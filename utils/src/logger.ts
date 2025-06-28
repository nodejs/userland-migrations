import { styleText } from "node:util";

type LogLevel = "info" | "warn" | "error" | "debug";
type LogColor = "cyan" | "yellow" | "red" | "magenta";

const LOGLEVELS: Record<LogLevel, number> = {
	error: 0,
	warn: 1,
	info: 2,
	debug: 3,
};

const currentLogLevel = LOGLEVELS[process.env.LOGLEVEL as LogLevel] ?? LOGLEVELS.info;

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

const logger = {
	info,
	warn,
	error,
	debug,
};

export default logger;
