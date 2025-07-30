const { builtinModules, foo, _builtinLibs } = require('node:repl');

console.log(builtinModules);
console.log(_builtinLibs);

foo(); // does something else
