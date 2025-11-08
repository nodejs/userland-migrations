import { connect } from "node:http2";
const session = connect("https://example.com");
session.settings({
    enablePush: true,
    priority: { weight: 16 }
});