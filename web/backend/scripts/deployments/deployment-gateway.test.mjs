import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { chooseComponent, createGateway, loadRouteCatalog, normalizeHost, parseRouteRecord } from "./deployment-gateway.mjs";

const execFileAsync = promisify(execFile);

const ids = {
  projectId: "11111111-1111-4111-8111-111111111111",
  versionId: "22222222-2222-4222-8222-222222222222",
  requestId: "33333333-3333-4333-8333-333333333333",
};
const record = (hostname = "demo.luxisoft.com") => ({
  schemaVersion: 1, ...ids, versionNumber: 7, updatedAt: new Date().toISOString(),
  hosts: [{ hostname, defaultComponent: "web" }],
  components: [
    { name: "web", surface: "http", port: 18080, routePrefix: null },
    { name: "api", surface: "http", port: 18081, routePrefix: "/api" },
  ],
});

test("normalizes hosts and selects the longest API prefix", () => {
  assert.equal(normalizeHost("DEMO.LUXISOFT.COM:443"), "demo.luxisoft.com");
  const route = { ...parseRouteRecord(record(), "fixture"), defaultComponent: "web" };
  assert.equal(chooseComponent(route, "/").name, "web");
  assert.equal(chooseComponent(route, "/api/orders").name, "api");
});

test("rejects invalid ports, duplicate hosts and unsafe archives", () => {
  assert.throws(() => parseRouteRecord({ ...record(), components: [{ name: "web", surface: "http", port: 80 }] }, "fixture"));
  assert.throws(() => parseRouteRecord({ ...record(), hosts: [{ hostname: "demo.luxisoft.com", defaultComponent: "web" }, { hostname: "demo.luxisoft.com", defaultComponent: "web" }] }, "fixture"));
  assert.throws(() => parseRouteRecord({ ...record(), components: [{ name: "web", surface: "static", port: null, staticArchive: { archive: "relative.zip", sha256: "a".repeat(64), bytes: 1, spa: true } }] }, "fixture"));
});

test("loads valid project routes and fails closed on duplicate host ownership", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gateway-routes-"));
  for (const [id, value] of [["a".repeat(64), record()], ["b".repeat(64), record()]]) {
    await mkdir(path.join(root, id));
    await writeFile(path.join(root, id, "routes.json"), JSON.stringify(value));
  }
  const loaded = await loadRouteCatalog(root);
  assert.equal(loaded.files, 2);
  assert.equal(loaded.routes.has("demo.luxisoft.com"), false);
});

test("serves health independently and returns 421 for unmanaged hosts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gateway-health-"));
  const gateway = createGateway({ routesRoot: root, cacheRoot: path.join(root, "cache"), trustedIps: new Set() });
  await new Promise((resolve) => gateway.server.listen(0, "127.0.0.1", resolve));
  const port = gateway.server.address().port;
  const request = (pathname, host) => new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: pathname, headers: { host } }, (res) => {
      const chunks = []; res.on("data", (chunk) => chunks.push(chunk)); res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    }); req.on("error", reject);
  });
  assert.equal((await request("/_health", "gateway.local")).status, 200);
  assert.equal((await request("/", "unknown.example")).status, 421);
  await new Promise((resolve) => gateway.server.close(resolve));
});

test("serves a verified retained static release without any control-plane lookup", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gateway-static-")), projectRoot = path.join(root, "c".repeat(64)),
    releaseRoot = path.join(projectRoot, "releases"), sourceRoot = path.join(root, "source"), archive = path.join(releaseRoot, "web.zip");
  await mkdir(releaseRoot, { recursive: true }); await mkdir(sourceRoot);
  await writeFile(path.join(sourceRoot, "index.html"), "<main>durable release</main>");
  await execFileAsync("/usr/bin/python3", ["-I", "-c", "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],'w'); z.write(sys.argv[2],'index.html'); z.close()", archive, path.join(sourceRoot, "index.html")]);
  const bytes = await import("node:fs/promises").then(fs => fs.readFile(archive)), sha256 = createHash("sha256").update(bytes).digest("hex");
  const route = {
    ...record(),
    components: [{ name: "web", surface: "static", port: null, routePrefix: null,
      staticArchive: { archive, sha256, bytes: bytes.length, spa: true } }],
  };
  await writeFile(path.join(projectRoot, "routes.json"), JSON.stringify(route));
  const gateway = createGateway({ routesRoot: root, cacheRoot: path.join(root, "cache"), trustedIps: new Set() });
  await gateway.reload();
  await new Promise((resolve) => gateway.server.listen(0, "127.0.0.1", resolve));
  const port = gateway.server.address().port;
  const response = await new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/account/profile", headers: { host: "demo.luxisoft.com" } }, res => {
      const chunks = []; res.on("data", chunk => chunks.push(chunk)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    }); req.on("error", reject);
  });
  assert.equal(response.status, 200); assert.equal(response.body, "<main>durable release</main>");
  assert.equal(response.headers["x-luxi-static-sha256"], sha256); assert.equal(response.headers["x-luxi-version"], "7");
  await new Promise((resolve) => gateway.server.close(resolve));
});
