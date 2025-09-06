import assert from "node:assert";

process.assert(config.port, "Port must be configured");
assert(config.port, "Port must be configured");