import { registerHooks } from 'node:module';
import bash from '@ast-grep/lang-bash';
import json from '@ast-grep/lang-json';
import { registerDynamicLanguage } from '@ast-grep/napi';

registerDynamicLanguage({
	json,
	bash,
});

registerHooks({
	resolve(url, context, nextResolve) {
		let newUrl = url;

		if (url === 'codemod:ast-grep') newUrl = '@ast-grep/napi';

		return nextResolve(newUrl, context);
	},
});
