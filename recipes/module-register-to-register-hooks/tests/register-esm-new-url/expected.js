import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as myHooks from './my-hooks.mjs';

registerHooks(myHooks);

console.log(pathToFileURL('.'));
