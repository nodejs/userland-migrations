import type { SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/*
 * todo: Swap calls to `timers.unenroll()` with the appropriate `clearTimeout` / `clearInterval` usage.
 */
export default function transform(root: SgRoot<Js>): string | null {
	root.root();

	return null;
}
