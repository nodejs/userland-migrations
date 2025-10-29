import type { SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/*
 * todo: Replace `timers.enroll()` with a `setTimeout()` handle stored on the resource.
 */
export default function transform(root: SgRoot<Js>): string | null {
	root.root();

	return null;
}
