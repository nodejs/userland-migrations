import { opendir } from 'node:fs/promises';

const dir = await opendir('./');
for await (const dirent of dir) {
  console.log(`Found ${dirent.name} in ${dirent.parentPath}`);
}
