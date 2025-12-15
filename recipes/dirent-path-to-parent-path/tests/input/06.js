import { join } from 'node:path';
import { readdir } from 'node:fs/promises';

async function getFilePaths(directory) {
  const dirents = await readdir(directory, { withFileTypes: true });
  return dirents
    .filter(dirent => dirent.isFile())
    .map(dirent => join(dirent.path, dirent.name));
}
