import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function walkDirectory(dirPath) {
  const dirents = await readdir(dirPath, { withFileTypes: true });

  for (const dirent of dirents) {
    const currentPath = join(dirent.parentPath, dirent.name);

    if (dirent.isDirectory()) {
      await walkDirectory(currentPath);
    } else {
      console.log(`File: ${currentPath}`);
    }
  }
}
