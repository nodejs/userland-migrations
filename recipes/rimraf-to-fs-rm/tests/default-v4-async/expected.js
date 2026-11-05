import { rm as rmPromise } from "node:fs/promises";

await rmPromise("dist", { recursive: true, force: true });
