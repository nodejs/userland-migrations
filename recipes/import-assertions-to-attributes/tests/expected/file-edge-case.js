import { createRequire } from 'node:module';
import data from './data.json' with { type: 'json' };
import systemOfADown from './system;of;a;down.json' with { type: 'json' };
import { default as config } from './config.json'with{type: 'json'};
import { thing } from "./data.json"with{type: 'json'};
import { fileURLToPath } from 'node:url' invalid { };
const require = createRequire(import.meta.url);
const foo = require('./foo.ts');

const data2 = await import('./data2.json', {
	with: { type: 'json' },
});

await import('foo-bis');
