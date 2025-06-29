exports[`workflow - import-assertions-to-attributes 1`] = `
"import { createRequire } from 'node:module';\\nimport data from './data.json' with { type: 'json' };\\nimport systemOfADown from './system;of;a;down.json' with { type: 'json' };\\nimport { default as config } from './config.json'with{type: 'json'};\\nimport { thing } from \\"./data.json\\"with{type: 'json'};\\nimport { fileURLToPath } from 'node:url' invalid { };\\nconst require = createRequire(import.meta.url);\\nconst foo = require('./foo.js');\\n\\nconst data2 = await import('./data2.json', {\\n\\twith: { type: 'json' },\\n});\\n\\nawait import('foo-bis');\\n"
`;

exports[`workflow - import-assertions-to-attributes 2`] = `
"async function main() {\\n\\tconst data = await import('./data.json', { with: { type: 'json' } });\\n\\tconst pkg = await import('pkg');\\n\\n\\treturn data;\\n}\\n"
`;

exports[`workflow - import-assertions-to-attributes 3`] = `
"import data from './data.json' with { type: 'json' };\\n\\nconst data2 = await import('./data2.json', {\\n\\twith: { type: 'json' },\\n});\\n\\nawait import('./data3.json', {\\n\\twith: { type: 'json' },\\n});\\n\\nawait import('pkg');\\n\\nfunction getData4() {\\n\\timport('pkg-bis');\\n\\n\\treturn import('./data4.json', {\\n\\t\\twith: { type: 'json' },\\n\\t});\\n}\\n"
`;

exports[`workflow - import-assertions-to-attributes 4`] = `
"import data from './data.json' with { type: 'json' };\\n\\nconst data2 = await import('./data2.json', {\\n\\twith: { type: 'json' },\\n});\\n\\nawait import('./data3.json', {\\n\\twith: { type: 'json' },\\n});\\n\\nawait import('pkg');\\n\\nfunction getData4() {\\n\\timport('pkg-bis');\\n\\n\\treturn import('./data4.json', {\\n\\t\\twith: { type: 'json' },\\n\\t});\\n}\\n"
`;
