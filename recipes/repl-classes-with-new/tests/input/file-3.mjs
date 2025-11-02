import { REPLServer } from "node:repl";

// ESM import with no arguments
const server = REPLServer();

// ESM import with options
const server2 = REPLServer({ 
  prompt: ">>> ",
  useColors: true
});

// ESM import in function
function createCustomREPL() {
  return REPLServer({
    prompt: "custom> "
  });
}
