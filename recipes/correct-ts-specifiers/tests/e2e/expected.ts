import { Bird } from './Bird/index.ts';
import { Cat } from './Cat.ts';

export type { Zed } from './zed.d.ts';

const nil = await import('./nil.ts');

const bird = new Bird('Tweety');
const cat = new Cat('Milo');

console.log('bird:', bird);
console.log('cat:', cat);
console.log('nil:', nil);
