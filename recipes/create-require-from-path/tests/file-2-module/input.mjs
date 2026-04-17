import { createRequireFromPath, resolve } from 'node:module';

const require = createRequireFromPath('/some/path');
const lib = require('some-library');
