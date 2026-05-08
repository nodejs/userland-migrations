import { Bird } from './Bird';
import { Cat } from './Cat.ts';

export { Zed } from './zed';

const nil = await import('./nil.js');

const bird = new Bird('Tweety');
const cat = new Cat('Milo');

console.log('bird:', bird);
console.log('cat:', cat);
console.log('nil:', nil);
