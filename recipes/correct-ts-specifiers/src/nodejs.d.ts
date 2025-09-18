// TODO: Delete this file once https://github.com/DefinitelyTyped/DefinitelyTyped/pull/72122
// is released in @types/node@22.15.x

import type { ResolveHook, LoadHook } from 'node:module';

declare module 'module' {
	namespace Module {
		function registerHooks(hooks: {
			resolve?: ResolveHook;
			load?: LoadHook;
		}): ModuleHooks;

		class ModuleHooks {
			constructor(resolve?: ResolveHook, load?: LoadHook);
			deregister(): void;
		}
	}
}
