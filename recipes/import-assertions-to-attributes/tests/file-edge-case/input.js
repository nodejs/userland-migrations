import { createRequire } from 'node:module';
import data from './data.json' assert { type: 'json' };
import systemOfADown from './system;of;a;down.json' assert { type: 'json' };
import { default as config } from './config.json'assert{type: 'json'};
import { thing } from "./data.json"assert{type: 'json'};
import { fileURLToPath } from 'node:url' invalid { };
const require = createRequire(import.meta.url);
const foo = require('./foo.ts');

const data2 = await import('./data2.json', {
	assert: { type: 'json' },
});

await import('foo-bis');
