// Example 3: Destructured import
const { REPLServer } = require("node:repl");
const server = new REPLServer({ prompt: ">>> " });

// Example 4: ESM import usage (simulated with require for testing)
// In real ESM: import { REPLServer } from "node:repl";
const server2 = new REPLServer();

// Another destructured case
const server3 = new REPLServer({
  prompt: "test> ",
  useColors: false
});
