const fs = require('fs');
const pkg = require('pkg');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

module.exports = { read };
