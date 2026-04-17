// Dynamic import with await
const { REPLServer, Recoverable } = await import("node:repl");

// REPLServer without new
const server = new REPLServer();

// Recoverable without new
const error = new Recoverable(new SyntaxError());

// With options
const server2 = new REPLServer({ 
  prompt: ">>> ",
  useColors: true
});
