const http2 = require("node:http2");
const session = http2.connect("https://example.com", {
    priority: {
        weight: 16,
        parent: 0,
        exclusive: false
    }
});
