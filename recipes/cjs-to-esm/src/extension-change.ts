/*
To interact with step output we need to use this functions.
import {
	getOrSetStepOutput,
	setStepOutput,
} from '@codemod.com/jssg-types/workflow';
*/
import type { SgRoot } from '@codemod.com/jssg-types/main';
import type JS from '@codemod.com/jssg-types/langs/javascript';

//const STEP_ID = 'change-extensions';
//const OUTPUT_NAME = 'extension_changes';

export default async function transform(
	root: SgRoot<JS>,
): Promise<string | null> {
	const sourcePath = root.filename();

	// do some stuff

	if (sourcePath.endsWith('.cjs')) {
		// ...
	}

	return null;
}
