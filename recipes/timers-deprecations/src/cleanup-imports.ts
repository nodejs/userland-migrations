import type { SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/*
 * todo: Remove unused `node:timers` imports once the deprecated APIs are migrated.
 */
export default function transform(root: SgRoot<Js>): string | null {
	root.root();

	return null;
}
