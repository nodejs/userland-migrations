import { writeFile } from "node:fs/promises";

const data = { toString: () => "async content" };
await writeFile("file.txt", data);
