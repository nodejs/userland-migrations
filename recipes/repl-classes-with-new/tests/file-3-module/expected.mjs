import { REPLServer } from "node:repl";

// ESM import with no arguments
const server = new REPLServer();

// ESM import with options
const server2 = new REPLServer({ 
  prompt: ">>> ",
  useColors: true
});

// ESM import in function
function createCustomREPL() {
  return new REPLServer({
    prompt: "custom> "
  });
}
