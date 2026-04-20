import { rmdir as foo } from "node:fs"; // should not be transformed

const pathName = "path/to/directory";

foo(pathName, { recursive: false });
