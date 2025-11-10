import util from "node:util";
import http from "node:http";

util.log("Debug message");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
	util.log(`[${req.method}] ${req.url}`);
	res.statusCode = 200;
	res.setHeader("Content-Type", "text/plain");
	res.end("Hello World\n");
});

server.listen(PORT, () => {
	util.log(`Server running at http://localhost:${PORT}/`);
});
