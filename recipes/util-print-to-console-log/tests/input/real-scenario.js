import util from "node:util";
import http from "node:http";

util.print("Debug message");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
	util.print(`[${req.method}] ${req.url}`);
	res.statusCode = 200;
	res.setHeader("Content-Type", "text/plain");
	res.end("Hello World\n");
});

server.listen(PORT, () => {
	util.print(`Server running at http://localhost:${PORT}/`);
});
