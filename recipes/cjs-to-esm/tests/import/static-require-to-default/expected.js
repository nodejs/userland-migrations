import fs from 'node:fs';
import pkg from 'pkg';

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

export default { read };
