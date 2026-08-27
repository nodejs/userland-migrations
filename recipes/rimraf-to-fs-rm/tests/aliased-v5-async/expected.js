import { rm as rmPromise } from "node:fs/promises";

await rmPromise("coverage", { recursive: true, force: true });
