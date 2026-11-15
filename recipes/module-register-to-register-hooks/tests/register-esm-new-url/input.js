import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./my-hooks.mjs', import.meta.url));

console.log(pathToFileURL('.'));
