import http from "node:http";

console.log("Debug message");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
	console.log(`[${req.method}] ${req.url}`);
	res.statusCode = 200;
	res.setHeader("Content-Type", "text/plain");
	res.end("Hello World\n");
});

server.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}/`);
});
