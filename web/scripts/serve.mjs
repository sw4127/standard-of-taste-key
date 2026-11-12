// Serves the static export in `out/` on http://localhost:3211, to look at the built site.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

// ROOT may point elsewhere, e.g. the extension's built panel, to look at it as a page.
const root = process.env.ROOT || fileURLToPath(new URL("../out/", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".json": "application/json", ".txt": "text/plain", ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml" };
const port = Number(process.env.PORT || 3211);
// The same headers Vercel sends (vercel.json), so the content security policy can be checked here.
const vercel = JSON.parse(readFileSync(fileURLToPath(new URL("../../vercel.json", import.meta.url)), "utf8"));
const siteHeaders = Object.fromEntries((vercel.headers ?? []).flatMap((h) => h.headers.map((x) => [x.key, x.value])));

createServer((req, res) => {
  let p = normalize(decodeURIComponent((req.url || "/").split("?")[0])).replace(/^([/\\])+/, "");
  if (p.includes("..")) return res.writeHead(400).end();
  let file = join(root, p);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) return res.writeHead(404).end("not found");
  res.writeHead(200, { ...(process.env.ROOT ? {} : siteHeaders), "content-type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving out/ on http://localhost:${port}`));
