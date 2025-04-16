import type { ResolveHook, LoadHook } from 'node:module';

declare module "module" {
	namespace Module {
		function registerHooks(hooks: {
			resolve?: ResolveHook,
			load?: LoadHook,
		}): ModuleHooks;

		class ModuleHooks {
			constructor(resolve?: ResolveHook, load?: LoadHook);
			deregister(): void;
		}
	}
}
