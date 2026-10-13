// Production HTTP server for the TanStack Start build.
// `vite build` emits dist/client (static assets) and dist/server/server.js (a fetch handler).
// This file serves the static assets and forwards every other request to the handler.
// Runtime configuration is read from the environment at request time (see docs/runtime-config.md).
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = import.meta.dirname;
const clientDir = path.join(root, "dist", "client");
const { default: app } = await import(path.join(root, "dist", "server", "server.js"));

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const MIME = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

async function serveStatic(pathname, res) {
  if (pathname === "/" || pathname.includes("\0")) return false;
  const file = path.normalize(path.join(clientDir, decodeURIComponent(pathname)));
  if (!file.startsWith(clientDir + path.sep)) return false;
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return false;
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
    "Content-Length": info.size,
    "Cache-Control": pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
  });
  await pipeline(createReadStream(file), res);
  return true;
}

function toRequest(req) {
  const proto = req.headers["x-forwarded-proto"]?.toString().split(",")[0] ?? "http";
  const authority = req.headers["x-forwarded-host"] ?? req.headers.host ?? `localhost:${port}`;
  const url = new URL(req.url ?? "/", `${proto}://${authority}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(name, v);
    else headers.set(name, value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

async function sendResponse(response, res) {
  const headers = {};
  response.headers.forEach((value, name) => {
    if (name === "set-cookie") return;
    headers[name] = value;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) headers["set-cookie"] = cookies;
  res.writeHead(response.status, response.statusText, headers);
  if (response.body === null) {
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(response.body), res);
}

const server = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if ((req.method === "GET" || req.method === "HEAD") && (await serveStatic(pathname, res))) return;
    await sendResponse(await app.fetch(toRequest(req)), res);
  } catch (error) {
    // Log the path only: query strings can carry verification or password-reset tokens.
    const path = (req.url ?? "/").split("?")[0];
    console.error(JSON.stringify({ level: "error", msg: "request failed", method: req.method, path, error: String(error) }));
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      level: "info",
      msg: "sprintboard web listening",
      host,
      port,
      environment: process.env.APP_ENVIRONMENT ?? "local",
      release: process.env.APP_RELEASE ?? "unreleased",
    }),
  );
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
