const { connect } = require("http2");
const session = connect("https://example.com");
session.settings({
    enablePush: true
});
