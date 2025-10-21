const { builtinModules: quez, foo, _builtinLibs: quux } = require('node:repl');

console.log(quez);
console.log(quux);

foo(); // does something else
