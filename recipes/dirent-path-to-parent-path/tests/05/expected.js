const { readdirSync } = require('node:fs');

const entries = readdirSync('./', { withFileTypes: true });
const files = entries.filter(dirent => {
  return dirent.isFile() && dirent.parentPath.includes('src');
});
