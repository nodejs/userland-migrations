const http2 = await import("node:http2");
const session = http2.connect("https://example.com");
session.settings({
    enablePush: true,
    priority: { weight: 16 }
});
