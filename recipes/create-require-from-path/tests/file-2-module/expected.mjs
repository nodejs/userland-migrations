import { createRequire, resolve } from 'node:module';

const require = createRequire('/some/path');
const lib = require('some-library');
