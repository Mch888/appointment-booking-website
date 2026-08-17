const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "127.0.0.1";
const port = process.env.PORT || 3000;
const rootDir = __dirname;

const mimeTypes = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml; charset=utf-8",
	".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((request, response) => {
	const requestPath = request.url === "/" ? "/index.html" : decodeURIComponent(request.url.split("?")[0]);
	const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
	const filePath = path.join(rootDir, safePath);

	if (!filePath.startsWith(rootDir)) {
		response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
		response.end("Forbidden");
		return;
	}

	fs.readFile(filePath, (error, data) => {
		if (error) {
			const statusCode = error.code === "ENOENT" ? 404 : 500;
			response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
			response.end(statusCode === 404 ? "Not found" : "Server error");
			return;
		}

		const extension = path.extname(filePath).toLowerCase();
		const contentType = mimeTypes[extension] || "application/octet-stream";

		response.writeHead(200, { "Content-Type": contentType });
		response.end(data);
	});
});

server.listen(port, host, () => {
	console.log(`
        ----------------------------------------
        Server running at http://${host}:${port}
        ----------------------------------------
    `);
});
