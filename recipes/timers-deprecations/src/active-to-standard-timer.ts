import type { SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

/*
 * todo: Remove usages of `timers.active()` in favor of public timer rescheduling helpers.
 */
export default function transform(root: SgRoot<Js>): string | null {
	root.root();

	return null;
}
