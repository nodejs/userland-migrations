import { readdir } from 'node:fs/promises';

const entries = await readdir('./directory', { withFileTypes: true });
entries.forEach((dirent) => {
  const fullPath = `${dirent.parentPath}/${dirent.name}`;
  console.log(fullPath);
});
