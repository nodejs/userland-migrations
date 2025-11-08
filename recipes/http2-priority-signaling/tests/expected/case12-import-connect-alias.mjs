import { connect as bar } from "node:http2";
const session = bar("https://example.com");
session.settings({
    enablePush: true
});