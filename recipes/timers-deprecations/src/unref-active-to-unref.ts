import type { SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/*
 * todo: Replace `timers._unrefActive()` with an unref'ed `setTimeout()` handle.
 */
export default function transform(root: SgRoot<Js>): string | null {
	root.root();

	return null;
}
