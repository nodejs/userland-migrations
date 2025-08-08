import { rmdir as foo } from "node:fs";

const pathName = "path/to/directory";

foo(pathName, { recursive: true }, () => {});
