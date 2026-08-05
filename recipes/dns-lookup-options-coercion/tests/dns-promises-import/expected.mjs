import { lookup } from "node:dns/promises";

await lookup("example.com", { family: 6, all: true });
