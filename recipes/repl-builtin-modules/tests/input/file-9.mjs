const { builtinModules } = await import('node:repl');
const repl = await import('node:repl');

console.log(builtinModules);
console.log(repl.builtinModules);
console.log(repl._builtinLibs);
