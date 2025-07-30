import { builtinModules, _builtinLibs, foo } from 'node:repl';

console.log(builtinModules);
console.log(_builtinLibs);

foo(); // does something else
