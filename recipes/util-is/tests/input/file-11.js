const { isNull: nil, isUndefined: und } = require('node:util');

if (nil(someValue)) {
    console.log('someValue is null');
}
if (und(someValue)) {
    console.log('someValue is undefined');
}
