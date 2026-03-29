const http2 = require("node:http2");
const session = http2.connect("https://example.com");
const stream = session.request({ ":path": "/" });
stream.priority({
    exclusive: true,
    parent: 0,
    weight: 128
});
