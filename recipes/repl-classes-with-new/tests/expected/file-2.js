// Destructured import
const { REPLServer, Recoverable } = require("node:repl");
const server = new REPLServer({ prompt: ">>> " });

// Recoverable without new
const error = new Recoverable(new SyntaxError());

// Another destructured case
const server2 = new REPLServer();

// With options
const server3 = new REPLServer({
  prompt: "test> ",
  useColors: false
});
