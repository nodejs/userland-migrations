import { rmSync } from "node:fs";
import { rm as rmPromise } from "node:fs/promises";

await rmPromise("dist", { recursive: true, force: true });
rmSync("build", { recursive: true, force: true });
