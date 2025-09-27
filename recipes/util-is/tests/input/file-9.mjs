import { isRegExp, callbackify } from 'node:util';

if (isRegExp(someValue)) {
    console.log('someValue is a regexp');
}
callbackify(() => { });
