import http2 from "node:http2";
const client = http2.connect("https://example.com");
client.settings({ enablePush: false });
