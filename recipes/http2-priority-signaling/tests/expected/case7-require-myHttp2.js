const myHttp2 = require("http2");
const session = myHttp2.connect("https://example.com");
session.settings({
    enablePush: true
});
