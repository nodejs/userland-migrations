import http from "node:http";

console.log(new Date().toLocaleString(), "Debug message");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
	console.log(new Date().toLocaleString(), `[${req.method}] ${req.url}`);
	res.statusCode = 200;
	res.setHeader("Content-Type", "text/plain");
	res.end("Hello World\n");
});

server.listen(PORT, () => {
	console.log(new Date().toLocaleString(), `Server running at http://localhost:${PORT}/`);
});
