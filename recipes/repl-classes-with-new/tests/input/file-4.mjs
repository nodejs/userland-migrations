// Dynamic import with await
const { REPLServer, Recoverable } = await import("node:repl");

// REPLServer without new
const server = REPLServer();

// Recoverable without new
const error = Recoverable(new SyntaxError());

// With options
const server2 = REPLServer({ 
  prompt: ">>> ",
  useColors: true
});
