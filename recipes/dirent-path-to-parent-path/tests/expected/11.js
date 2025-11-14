import { readdir } from 'node:fs/promises';

const entries = await readdir('./directory', { withFileTypes: true });
entries.forEach(({parentPath, name}) => {
  const fullPath = `${parentPath}/${name}`;
  console.log(fullPath);
});
