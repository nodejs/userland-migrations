import * as foo from "node:http2";
const session = foo.connect("https://example.com");
session.settings({
    enablePush: true
});