#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import http from "node:http";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const HOST_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const UUID_RE = /^[a-f0-9-]{36}$/;
const NAME_RE = /^[a-z][a-z0-9-]{0,29}$/;
const SHA_RE = /^[a-f0-9]{64}$/;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".pdf": "application/pdf",
};
const EXTRACTOR = `import os,stat,sys,zipfile\narchive,dest=sys.argv[1:]\ncount=0;total=0\nwith zipfile.ZipFile(archive) as z:\n for info in z.infolist():\n  name=info.filename.rstrip('/')\n  if not name: continue\n  parts=name.split('/')\n  mode=info.external_attr>>16\n  if name.startswith('/') or '\\\\' in name or any(p in ('','.','..') for p in parts) or stat.S_ISLNK(mode): raise Exception('unsafe_static_archive')\n  if info.is_dir(): continue\n  if mode and not stat.S_ISREG(mode): raise Exception('unsafe_static_file')\n  count+=1;total+=info.file_size\n  if count>10000 or info.file_size>16777216 or total>134217728: raise Exception('static_archive_limit')\n  target=os.path.join(dest,*parts);os.makedirs(os.path.dirname(target),exist_ok=True)\n  with z.open(info) as src,open(target,'xb') as out:\n   while True:\n    chunk=src.read(1048576)\n    if not chunk: break\n    out.write(chunk)\n  os.chmod(target,0o644)\n if not os.path.isfile(os.path.join(dest,'index.html')): raise Exception('static_index_missing')\n`;

export function normalizeHost(value) {
  return String(Array.isArray(value) ? value[0] ?? "" : value ?? "").split(",")[0].trim().toLowerCase().split(":")[0];
}

export function normalizeIp(value) {
  const clean = String(value ?? "").trim().toLowerCase();
  return (clean.startsWith("::ffff:") ? clean.slice(7) : clean).split("%")[0];
}

export function parseTrustedIps(value) {
  return new Set(String(value ?? "").split(",").map(normalizeIp).filter(Boolean));
}

function validComponent(component) {
  if (!component || !NAME_RE.test(component.name) || !["http", "static"].includes(component.surface)) return false;
  if (component.routePrefix !== null && component.routePrefix !== undefined && !/^\/[A-Za-z0-9_/-]+$/.test(component.routePrefix)) return false;
  if (component.surface === "http") return Number.isInteger(component.port) && component.port >= 1024 && component.port <= 65535;
  const archive = component.staticArchive;
  return component.port === null && archive && typeof archive.archive === "string" && archive.archive.startsWith("/") &&
    SHA_RE.test(archive.sha256) && Number.isSafeInteger(archive.bytes) && archive.bytes > 0 && archive.bytes <= 32 * 1024 * 1024 &&
    typeof archive.spa === "boolean";
}

export function parseRouteRecord(value, source) {
  if (!value || value.schemaVersion !== 1 || !UUID_RE.test(value.projectId ?? "") || !UUID_RE.test(value.versionId ?? "") ||
      !UUID_RE.test(value.requestId ?? "") || !Number.isInteger(value.versionNumber) || value.versionNumber < 1 ||
      !Array.isArray(value.components) || !value.components.length || !value.components.every(validComponent) ||
      !Array.isArray(value.hosts) || !value.hosts.length) throw new Error("invalid_route_record");
  const names = new Set(value.components.map((component) => component.name));
  if (names.size !== value.components.length) throw new Error("duplicate_route_component");
  const hosts = value.hosts.map((host) => {
    const hostname = normalizeHost(host.hostname);
    if (!HOST_RE.test(hostname) || !names.has(host.defaultComponent)) throw new Error("invalid_route_host");
    return { hostname, defaultComponent: host.defaultComponent };
  });
  if (new Set(hosts.map((host) => host.hostname)).size !== hosts.length) throw new Error("duplicate_route_host");
  return { ...value, hosts, source, components: value.components.map((component) => ({ ...component })) };
}

export function chooseComponent(route, pathname) {
  const prefixed = route.components.filter((component) => component.surface === "http" && component.routePrefix &&
    (pathname === component.routePrefix || pathname.startsWith(component.routePrefix + "/")))
    .sort((a, b) => b.routePrefix.length - a.routePrefix.length)[0];
  return prefixed ?? route.components.find((component) => component.name === route.defaultComponent) ?? null;
}

export async function loadRouteCatalog(root) {
  const next = new Map();
  const conflicts = new Set();
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return { routes: new Map(), files: 0 }; throw error; }
  let files = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
    const file = path.join(root, entry.name, "routes.json");
    try {
      const record = parseRouteRecord(JSON.parse(await readFile(file, "utf8")), file);
      files += 1;
      for (const host of record.hosts) {
        if (next.has(host.hostname)) { conflicts.add(host.hostname); next.delete(host.hostname); continue; }
        if (!conflicts.has(host.hostname)) next.set(host.hostname, { ...record, defaultComponent: host.defaultComponent });
      }
    } catch (error) {
      if (error.code !== "ENOENT") process.stderr.write(`project_gateway_route_invalid ${file} ${String(error.message).slice(0, 160)}\n`);
    }
  }
  return { routes: next, files };
}

function candidatePaths(pathname, spa) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return []; }
  if (!decoded.startsWith("/") || decoded.includes("\\") || decoded.includes("\0")) return [];
  const parts = decoded.split("/").slice(1);
  if (parts.some((part) => part === "." || part === ".." || (part.startsWith(".") && part !== ".well-known"))) return [];
  const normalized = parts.filter(Boolean).join("/");
  if (!normalized) return ["index.html"];
  const values = [normalized, normalized.replace(/\/$/, "") + "/index.html"];
  if (spa && !path.posix.extname(normalized)) values.push("index.html");
  return values;
}

function digestFile(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256"), stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk)); stream.on("error", reject); stream.on("end", () => resolve(hash.digest("hex")));
  });
}

const pendingStatic = new Map();
async function installStatic(component, routesRoot, cacheRoot) {
  const meta = component.staticArchive;
  const target = path.join(cacheRoot, meta.sha256);
  try { if ((await stat(path.join(target, "index.html"))).isFile()) return target; } catch {}
  if (pendingStatic.has(target)) return pendingStatic.get(target);
  const work = (async () => {
    const rootReal = await realpath(routesRoot), archiveReal = await realpath(meta.archive);
    if (!archiveReal.startsWith(rootReal + path.sep)) throw new Error("static_archive_outside_routes");
    const info = await stat(archiveReal);
    if (!info.isFile() || info.size !== meta.bytes || await digestFile(archiveReal) !== meta.sha256) throw new Error("static_archive_invalid");
    await mkdir(cacheRoot, { recursive: true, mode: 0o700 });
    const stage = await mkdtemp(path.join(cacheRoot, ".install-"));
    try {
      await execFileAsync("/usr/bin/python3", ["-I", "-c", EXTRACTOR, archiveReal, stage], { timeout: 120000 });
      try { await rename(stage, target); } catch (error) { if (error.code !== "EEXIST" && error.code !== "ENOTEMPTY") throw error; }
      if (!(await stat(path.join(target, "index.html"))).isFile()) throw new Error("static_index_missing");
      return target;
    } finally { await rm(stage, { recursive: true, force: true }).catch(() => {}); }
  })();
  pendingStatic.set(target, work);
  try { return await work; } finally { pendingStatic.delete(target); }
}

function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(payload);
}

async function serveStatic(req, res, url, route, component, routesRoot, cacheRoot) {
  if (!['GET', 'HEAD'].includes(req.method ?? '')) return sendJson(res, 405, { ok: false, error: "method_not_allowed" }, { allow: "GET, HEAD" });
  const directory = await installStatic(component, routesRoot, cacheRoot);
  for (const relative of candidatePaths(url.pathname, component.staticArchive.spa)) {
    const file = path.resolve(directory, relative);
    if (!file.startsWith(directory + path.sep)) continue;
    let info; try { info = await stat(file); } catch { continue; }
    if (!info.isFile()) continue;
    const document = relative.endsWith(".html");
    res.writeHead(200, {
      "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "content-length": String(info.size), "x-content-type-options": "nosniff",
      "cache-control": document ? "no-cache" : relative.startsWith("assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
      "x-luxi-project-type": "repository", "x-luxi-version": String(route.versionNumber),
      "x-luxi-static-sha256": component.staticArchive.sha256,
    });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).on("error", () => res.destroy()).pipe(res); return;
  }
  sendJson(res, 404, { ok: false, error: "not_found" }, { "x-luxi-project-type": "repository" });
}

function proxyRequest(req, res, route, component) {
  return new Promise((resolve) => {
    const headers = { ...req.headers, host: normalizeHost(req.headers.host), "x-forwarded-host": normalizeHost(req.headers.host), "x-forwarded-proto": "https" };
    for (const key of ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]) delete headers[key];
    const upstream = http.request({ host: "127.0.0.1", port: component.port, method: req.method, path: req.url, headers }, (response) => {
      const outgoing = { ...response.headers, "x-luxi-project-type": "repository", "x-luxi-version": String(route.versionNumber) };
      delete outgoing.connection; delete outgoing["transfer-encoding"];
      res.writeHead(response.statusCode ?? 502, outgoing); response.pipe(res);
      response.on("end", resolve); response.on("error", () => { res.destroy(); resolve(); });
    });
    upstream.setTimeout(3_600_000, () => upstream.destroy(new Error("project_timeout")));
    upstream.on("error", () => { if (!res.headersSent) sendJson(res, 503, { ok: false, error: "project_temporarily_unavailable" }); else res.destroy(); resolve(); });
    req.on("aborted", () => upstream.destroy()); res.on("close", () => { if (!res.writableEnded) upstream.destroy(); }); req.pipe(upstream);
  });
}

export function createGateway({ routesRoot, cacheRoot, trustedIps, initialRoutes = new Map() }) {
  let catalog = initialRoutes, revision = 0;
  const reload = async () => {
    const loaded = await loadRouteCatalog(routesRoot);
    catalog = loaded.routes; revision += 1;
    return { routes: catalog.size, files: loaded.files, revision };
  };
  const server = http.createServer((req, res) => {
    void (async () => {
      const ip = normalizeIp(req.socket.remoteAddress);
      if (trustedIps.size && !trustedIps.has(ip)) return sendJson(res, 403, { ok: false, error: "forbidden" });
      const url = new URL(req.url ?? "/", "http://project.local"), host = normalizeHost(req.headers["x-forwarded-host"] ?? req.headers.host);
      if (url.pathname === "/_health") return sendJson(res, 200, { ok: true, service: "luxisoft-project-gateway", routes: catalog.size, revision });
      const route = catalog.get(host);
      if (!route) return sendJson(res, 421, { ok: false, error: "unmanaged_host" });
      const component = chooseComponent(route, url.pathname);
      if (!component) return sendJson(res, 503, { ok: false, error: "project_route_invalid" });
      if (component.surface === "static") return serveStatic(req, res, url, route, component, routesRoot, cacheRoot);
      await proxyRequest(req, res, route, component);
    })().catch((error) => {
      process.stderr.write(`project_gateway_request_failed ${String(error.message).slice(0, 180)}\n`);
      if (!res.headersSent) sendJson(res, 503, { ok: false, error: "project_temporarily_unavailable" }); else res.destroy();
    });
  });
  server.on("upgrade", (req, socket, head) => {
    const ip = normalizeIp(req.socket.remoteAddress), host = normalizeHost(req.headers["x-forwarded-host"] ?? req.headers.host);
    if ((trustedIps.size && !trustedIps.has(ip)) || !catalog.has(host)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return;
    }
    const route = catalog.get(host), url = new URL(req.url ?? "/", "http://project.local"), component = chooseComponent(route, url.pathname);
    if (!component || component.surface !== "http") {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n"); return;
    }
    const headers = { ...req.headers, host, "x-forwarded-host": host, "x-forwarded-proto": "https", connection: "Upgrade", upgrade: req.headers.upgrade };
    const upstream = http.request({ host: "127.0.0.1", port: component.port, method: req.method, path: req.url, headers });
    upstream.on("upgrade", (response, remote, buffer) => {
      socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers).map(([key, value]) => `${key}: ${value}`).join("\r\n")}\r\n\r\n`);
      if (head.length) remote.write(head); if (buffer.length) socket.write(buffer);
      remote.pipe(socket); socket.pipe(remote);
      remote.on("error", () => socket.destroy()); socket.on("error", () => remote.destroy());
      remote.on("close", () => socket.destroy()); socket.on("close", () => remote.destroy());
    });
    upstream.on("response", (response) => { response.resume(); socket.end(`HTTP/1.1 ${response.statusCode ?? 502} Rejected\r\nConnection: close\r\n\r\n`); });
    upstream.on("error", () => socket.destroy()); upstream.setTimeout(15_000, () => upstream.destroy()); upstream.end();
  });
  return { server, reload, routes: () => catalog };
}

async function main() {
  const runtime = JSON.parse(await readFile(process.env.LUXIPANEL_DEPLOYMENT_RUNTIME_CONFIG ?? "/etc/luxipanel-deployment-runtime.json", "utf8"));
  const routesRoot = path.join(runtime.configRoot, "hosting", "deployments"), cacheRoot = process.env.PROJECT_GATEWAY_CACHE_ROOT ?? "/var/lib/luxipanel/project-gateway";
  const trusted = parseTrustedIps(process.env.PROJECT_GATEWAY_TRUSTED_IPS ?? "127.0.0.1,::1");
  const gateway = createGateway({ routesRoot, cacheRoot, trustedIps: trusted });
  await gateway.reload();
  const timer = setInterval(() => gateway.reload().catch((error) => process.stderr.write(`project_gateway_reload_failed ${String(error.message).slice(0, 180)}\n`)), 2_000);
  timer.unref();
  const port = Number(process.env.PROJECT_GATEWAY_PORT ?? 3460), host = process.env.PROJECT_GATEWAY_HOST ?? "0.0.0.0";
  gateway.server.listen(port, host, () => process.stdout.write(`luxisoft-project-gateway listening on ${host}:${port}\n`));
  const shutdown = () => { clearInterval(timer); gateway.server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5_000).unref(); };
  process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) void main();
