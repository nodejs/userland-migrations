# `net._setSimultaneousAccepts()` DEP0121

This recipe provides a guide for removing `net._setSimultaneousAccepts()`.

See [DEP0121](https://nodejs.org/api/deprecations.html#DEP0121).

## Examples

### Remove internal API call

```diff
  const net = require("node:net");

- net._setSimultaneousAccepts(false);
  const server = net.createServer();
```

### Remove from server initialization

```diff
  const net = require("node:net");

  function createServer() {
-   net._setSimultaneousAccepts(true);
    return net.createServer((socket) => {
      // handle connection
    });
  }
```

### Remove from module setup

```diff
  const net = require("node:net");

- net._setSimultaneousAccepts(false);
  module.exports = {
    createServer: () => net.createServer()
  };
```

### Remove from application startup

```diff
  const net = require("node:net");

  function initializeApp() {
-   net._setSimultaneousAccepts(true);
    const server = net.createServer();
    server.listen(3000);
  }
```

### ESM import cleanup

```diff
  import net from "node:net";

- net._setSimultaneousAccepts(false);
  const server = net.createServer();
```

### Remove from configuration

```diff
  const net = require("node:net");

  const config = {
-  simultaneousAccepts: false,
   port: 8080
 };

 function setupServer(config) {
-  net._setSimultaneousAccepts(config.simultaneousAccepts);
   return net.createServer().listen(config.port);
 }
```
