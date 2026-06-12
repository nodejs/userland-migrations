import { rmSync } from "node:fs";

rmSync("tmp", { recursive: true, force: true });
