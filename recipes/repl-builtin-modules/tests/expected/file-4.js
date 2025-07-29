const { foo } = require('node:repl');
const { builtinModules } = require('node:module');

console.log(builtinModules);

foo(); // does something else
