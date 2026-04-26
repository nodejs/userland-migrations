import { callbackify } from 'node:util';

if (someValue instanceof RegExp) {
    console.log('someValue is a regexp');
}
callbackify(() => { });
