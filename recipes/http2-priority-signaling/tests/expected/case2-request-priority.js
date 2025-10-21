const http2 = require("node:http2");
const stream = session.request({
    ":path": "/api/data"
});
