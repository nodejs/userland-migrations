import process from 'node:process';

type LogMsg = string;
type LogType = 'error' | 'log' | 'warn';
type FileLog = { msg: LogMsg; type: LogType; codemodName: string };
type Source = URL['pathname'];

let defaultCodemodName = 'nodjs-codemod';

/**
 * Set the default codemod name for logging output
 */
export const setCodemodName = (name: string) => {
    defaultCodemodName = name;
};

/**
 * Collect log entries and report them at the end, collated by source module.
 */
export const logger = (source: Source, type: LogType, msg: LogMsg, codemodName?: string) => {
    const name = codemodName ?? defaultCodemodName;
    const fileLog = new Set<FileLog>(logs.has(source) ? logs.get(source) : []);

    fileLog.add({ msg, type, codemodName: name });
    logs.set(source, fileLog);
};

/**
 * @type {Map<URL['pathname'], Set<Record<LogMsg, LogType>>>}
 */
const logs = new Map<Source, Set<FileLog>>();

process.once('beforeExit', emitLogs);

function emitLogs() {
    let hasError = false;

    // Group logs by codemod name first, then by source file
    const logsByCodemod = new Map<string, Map<Source, Set<FileLog>>>();

    for (const [sourceFile, fileLogs] of logs.entries()) {
        for (const fileLog of fileLogs) {
            if (!logsByCodemod.has(fileLog.codemodName)) {
                logsByCodemod.set(fileLog.codemodName, new Map());
            }
            const codemodLogs = logsByCodemod.get(fileLog.codemodName)!;
            if (!codemodLogs.has(sourceFile)) {
                codemodLogs.set(sourceFile, new Set());
            }
            codemodLogs.get(sourceFile)!.add(fileLog);
        }
    }

    for (const [codemodName, codemodLogs] of logsByCodemod.entries()) {
        for (const [sourceFile, fileLogs] of codemodLogs.entries()) {
            console.log(`[Codemod: ${codemodName}]:`, sourceFile);
            for (const { msg, type } of fileLogs) {
                console[type](' •', msg);
                if (type === 'error') hasError = true;
            }
        }

        if (hasError) {
            console.error(`[Codemod: ${codemodName}]: migration incomplete!`);
        } else {
            console.log(`[Codemod: ${codemodName}]: migration complete!`);
        }
        hasError = false; // Reset for next codemod
    }

    // Set overall exit code based on any errors
    process.exitCode = Array.from(logsByCodemod.values())
        .some(codemodLogs =>
            Array.from(codemodLogs.values())
                .some(fileLogs =>
                    Array.from(fileLogs).some(log => log.type === 'error')
                )
        ) ? 1 : 0;
}
