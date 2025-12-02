import { readdir } from 'node:fs/promises';

const entries = await readdir('./directory', { withFileTypes: true });
entries.forEach(({path, name}) => {
  const fullPath = `${path}/${name}`;
  console.log(fullPath);
});
