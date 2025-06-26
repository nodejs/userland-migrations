import { styleText } from "node:util";

export function info(codemodName: string, ...args: unknown[]) {
  console.info(styleText(["bold", 'cyan'], `[${codemodName}]`), ...args);
}

export function warn(codemodName: string, ...args: unknown[]) {
	  console.warn(styleText(["bold", 'yellow'], `[${codemodName}]`), ...args);
}

export function error(codemodName: string, ...args: unknown[]) {
  console.error(styleText(["bold", 'red'], `[${codemodName}]`), ...args);
}

export function debug(codemodName: string, ...args: unknown[]) {
  if (process.env.DEBUG) {
	console.debug(styleText(["bold", 'magenta'], `[${codemodName}]`), ...args);
  }
}

const logger = {
	info,
	warn,
	error,
	debug,
};

export default logger;
