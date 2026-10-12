import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { PrismaClient } from "@prisma/client";
import { createSitepingHandler } from "@siteping/adapter-prisma";

const prisma = new PrismaClient();
const list = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);
const apiKey = process.env.SITEPING_API_KEY;
if (!apiKey) throw new Error("SITEPING_API_KEY is required");

const siteping = createSitepingHandler({
  prisma,
  apiKey,
  allowedOrigins: list(process.env.ALLOWED_ORIGINS),
  publicEndpoints: list(process.env.PUBLIC_METHODS || "POST,OPTIONS"),
});
const METHODS = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"];
const PUBLIC = join(process.cwd(), "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };

const inboxHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SitePing inbox</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/inbox/main.css" onerror="this.remove()"><script>window.__DEFAULT_PROJECTS__=${JSON.stringify(process.env.DEFAULT_PROJECTS || "")}</script></head><body style="margin:0"><div id="root"></div><script type="module" src="/inbox/main.js"></script></body></html>`;

async function toResponse(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/healthz") return res.writeHead(200, { "content-type": "text/plain" }).end("ok");
  if (url.pathname === "/api/siteping") {
    const handle = METHODS.includes(req.method) ? siteping[req.method] : null;
    if (!handle) return res.writeHead(405, { Allow: METHODS.join(", ") }).end();
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : null;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    const proto = req.headers["x-forwarded-proto"] || "http";
    const r = await handle(new Request(`${proto}://${req.headers.host}${req.url}`, { method: req.method, headers, body: body && body.length ? body : null }));
    const out = {};
    r.headers.forEach((v, k) => (out[k] = v));
    res.writeHead(r.status, out);
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  if (url.pathname === "/" ) return res.writeHead(302, { Location: "/inbox" }).end();
  if (url.pathname === "/inbox" || url.pathname === "/inbox/") return res.writeHead(200, { "content-type": TYPES[".html"], "cache-control": "no-store" }).end(inboxHtml);
  if (url.pathname.startsWith("/inbox/")) {
    const p = normalize(join(PUBLIC, url.pathname));
    if (!p.startsWith(PUBLIC)) return res.writeHead(403).end();
    try { return res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream", "cache-control": "public, max-age=3600" }).end(await readFile(p)); } catch {}
  }
  res.writeHead(404, { "content-type": "text/plain" }).end("not found");
}

http.createServer((req, res) => toResponse(req, res).catch((e) => { console.error(e); if (!res.headersSent) res.writeHead(500); res.end("error"); }))
  .listen(Number(process.env.PORT || 8080), "0.0.0.0", () => console.log("siteping server on", process.env.PORT || 8080));
