const http = require("http");
const fs = require("fs");
const path = require("path");

// load env vars (you manage .env locally)
require("dotenv").config();

const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

const TEST_RECIPIENT = process.env.TESUSER || "";
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER || "no-reply@localhost";

async function setupTransporter() {
	// Try configured SMTP creds first
	if (process.env.SMTP_USER && process.env.SMTP_PASS) {
		const configured = nodemailer.createTransport({
			service: process.env.SMTP_SERVICE || "gmail",
			auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
		});
		try {
			await configured.verify();
			console.log('SMTP verify OK (configured transport)');
			return configured;
		} catch (err) {
			console.error('Configured SMTP verify failed:', err && err.message ? err.message : err);
		}
	} else {
		console.log('SMTP credentials missing; will fall back to Ethereal for startup test');
	}

	// Fallback: Ethereal test account
	try {
		const testAccount = await nodemailer.createTestAccount();
		const eth = nodemailer.createTransport({
			host: 'smtp.ethereal.email',
			port: 587,
			auth: { user: testAccount.user, pass: testAccount.pass },
		});
		console.log('Using Ethereal test account for startup email');
		return eth;
	} catch (err) {
		console.error('Ethereal fallback failed:', err && err.message ? err.message : err);
		return null;
	}
}

async function sendStartupEmail(transporter) {
	if (!TEST_RECIPIENT) return;
	if (!transporter) {
		console.log('No transporter available; skipping startup email.');
		return;
	}
	try {
		const info = await transporter.sendMail({
			from: `"Studio North" <${FROM_EMAIL}>`,
			to: TEST_RECIPIENT,
			subject: 'Test: server startup',
			text: `Server startup test at ${new Date().toISOString()}`,
		});
		console.log(`Startup email sent to ${TEST_RECIPIENT}` + (info && info.messageId ? ` (id=${info.messageId})` : ''));
		// If using Ethereal, provide preview URL
		try {
			const url = nodemailer.getTestMessageUrl && nodemailer.getTestMessageUrl(info);
			if (url) console.log('Ethereal preview URL:', url);
		} catch (e) {
			// ignore
		}
	} catch (err) {
		console.error('Startup email failed:', err && err.message ? err.message : err);
	}
}

async function runDbHealthcheck() {
	const uri = process.env.MONGO_URI;
	if (!uri) {
		console.log("No MONGO_URI configured; skipping DB healthcheck");
		return;
	}
	try {
		await mongoose.connect(uri);
		const schema = new mongoose.Schema({ type: String, ts: Date }, { strict: false });
		const Health = mongoose.model("Healthcheck", schema, "healthchecks");
		const doc = await Health.create({ type: "startup", ts: new Date() });
		await Health.deleteOne({ _id: doc._id });
		console.log("DB healthcheck OK");
		await mongoose.disconnect();
	} catch (err) {
		console.error("DB healthcheck failed:", err && err.message ? err.message : err);
	}
}

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
	// non-blocking startup checks
	runDbHealthcheck();
	setupTransporter()
		.then(transporter => {
			if (transporter) sendStartupEmail(transporter);
		})
		.catch(e => console.error('No transporter available for startup email:', e && e.message ? e.message : e));
});
