import { foo } from 'node:repl';
import { builtinModules } from 'node:module';

console.log(builtinModules);

foo(); // does something else
