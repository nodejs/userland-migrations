const { connect: bar } = require("http2");
const session = bar("https://example.com");
session.settings({
    enablePush: true
});