const repl = require("node:repl");

// Example 1: Basic REPL server instantiation
const server = repl.REPLServer();

// Example 2: REPL server with options
const server2 = repl.REPLServer({
  prompt: "custom> ",
  input: process.stdin,
  output: process.stdout
});

// Example 5: Function parameter usage
function createREPL(options) {
  return repl.REPLServer(options);
}

// Example 6: Variable assignment with configuration
const customREPL = repl.REPLServer({
  prompt: "node> ",
  useColors: true,
  useGlobal: false
});
