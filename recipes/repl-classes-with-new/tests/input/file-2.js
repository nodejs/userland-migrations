// Destructured import
const { REPLServer, Recoverable } = require("node:repl");
const server = REPLServer({ prompt: ">>> " });

// Recoverable without new
const error = Recoverable(new SyntaxError());

// Another destructured case
const server2 = REPLServer();

// With options
const server3 = REPLServer({
  prompt: "test> ",
  useColors: false
});
