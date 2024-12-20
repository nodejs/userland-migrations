import { URL } from 'node:url';

import { bar } from '@dep/bar';
import { foo } from 'foo';

import { Bird } from './Bird';
import { Cat } from './Cat.ts';
import { Dog } from '…/Dog/index.mjs';
import { baseUrl } from '#config.js';

export { Zed } from './zed';

// should be unchanged

const nil = await import('./nil.js');

const bird = new Bird('Tweety');
const cat = new Cat('Milo');
const dog = new Dog('Otis');

export const makeLink = (path: URL) => (new URL(path, baseUrl)).href;

console.log('bird:', bird);
console.log('cat:', cat);
console.log('dog:', dog);
console.log('foo:', foo);
console.log('bar:', bar);
console.log('nil:', nil);
