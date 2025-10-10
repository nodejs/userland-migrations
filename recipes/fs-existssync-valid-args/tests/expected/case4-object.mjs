import { existsSync } from "node:fs";

const exists = existsSync(String({ path: '/some/file' }));

