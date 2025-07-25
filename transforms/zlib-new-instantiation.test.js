const path = require('path');
const defineTest = require('jscodeshift/dist/testUtils').defineTest;

defineTest(
  path.join(__dirname, 'zlib-new-instantiation'),
  'zlib-new-instantiation',
  null,
  'zlib-new-instantiation'
);

