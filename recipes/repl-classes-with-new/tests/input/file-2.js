// Example 3: Destructured import
const { REPLServer } = require("node:repl");
const server = REPLServer({ prompt: ">>> " });

// Example 4: ESM import usage (simulated with require for testing)
// In real ESM: import { REPLServer } from "node:repl";
const server2 = REPLServer();

// Another destructured case
const server3 = REPLServer({
  prompt: "test> ",
  useColors: false
});
