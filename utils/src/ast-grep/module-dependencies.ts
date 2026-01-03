import type { SgRoot } from '@codemod.com/jssg-types/main';
import type Js from '@codemod.com/jssg-types/langs/javascript';

import {
	getNodeImportStatements,
	getNodeImportCalls,
} from './import-statement.ts';
import { getNodeRequireCalls } from './require-call.ts';

export function getModuleDependencies(node: SgRoot<Js>, name: string) {
	return [
		...getNodeRequireCalls(node, name),
		...getNodeImportStatements(node, name),
		...getNodeImportCalls(node, name),
	];
}
