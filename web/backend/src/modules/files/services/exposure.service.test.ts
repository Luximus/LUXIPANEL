// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listSitesMock = vi.fn();
vi.mock("../../nginx/services/index.js", () => ({
  nginxSitesService: { listSites: (...a: unknown[]) => listSitesMock(...a) },
}));
const captureMock = vi.fn(async () => null);
vi.mock("./snapshot.service.js", () => ({
  snapshotService: { capture: (...a: unknown[]) => captureMock(...a) },
}));
vi.mock("../../../shared/files-cache/index.js", () => ({
  invalidateDir: vi.fn(), invalidateFile: vi.fn(), invalidateStat: vi.fn(),
}));

const { exposureService } = await import("./exposure.service.js");
const { ALLOWED_BASES, setAllowedBases } = await import("./filesystem.service.js");

let tempRoot = "";
let originalBases: string[] = [];

beforeEach(() => {
  listSitesMock.mockReset();
  captureMock.mockClear();
  originalBases = [...ALLOWED_BASES];
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "luxipanel-exp-"));
  setAllowedBases([tempRoot]);
});
afterEach(() => {
  setAllowedBases(originalBases);
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

function site(over: Record<string, unknown>) {
  return { name: "s", file: "f", enabled: true, domains: ["site.com"], root: `${tempRoot}/pub`, proxyPass: null, ssl: true, kind: "static", ...over };
}

describe("exposureService.publicRoots", () => {
  it("keeps enabled file-serving vhosts, drops proxies/disabled/no-root", async () => {
    listSitesMock.mockResolvedValue([
      site({ root: `${tempRoot}/a`, domains: ["a.com"] }),
      site({ root: `${tempRoot}/b`, proxyPass: "http://localhost:3000" }), // proxy → skip
      site({ root: null }), // no root → skip
      site({ root: `${tempRoot}/c`, enabled: false }), // disabled → skip
    ]);
    const roots = await exposureService.publicRoots({ target: { id: "r", name: "R" } } as never);
    expect(roots.map((r) => r.root)).toEqual([`${tempRoot}/a`]);
    expect(roots[0]?.domain).toBe("a.com");
    expect(roots[0]?.ssl).toBe(true);
  });
});

describe("exposureService.scan", () => {
  it("classifies sensitive files found under a public root", async () => {
    listSitesMock.mockResolvedValue([site({ root: `${tempRoot}/pub`, domains: ["site.com"], ssl: true })]);
    const exec = vi.fn(async () => ({
      stdout: [`${tempRoot}/pub/.env`, `${tempRoot}/pub/backup.zip`, `${tempRoot}/pub/.git`, `${tempRoot}/pub/readme.txt`].join("\n"),
      stderr: "", exitCode: 0, durationMs: 1,
    }));
    const res = await exposureService.scan({ target: { id: "r", name: "R" }, exec } as never);
    const byName = Object.fromEntries(res.findings.map((f) => [f.name, f]));
    expect(byName[".env"]?.risk).toBe("high");
    expect(byName[".env"]?.url).toBe("https://site.com/.env");
    expect(byName["backup.zip"]?.risk).toBe("medium");
    expect(byName[".git"]?.reason).toContain("Git");
    expect(byName["readme.txt"]).toBeUndefined(); // not sensitive
    // high-risk sorted first
    expect(res.findings[0]?.risk).toBe("high");
  });
});

describe("exposureService.probe", () => {
  it("recomputes the URL server-side and fetches it (SSRF-safe)", async () => {
    listSitesMock.mockResolvedValue([site({ root: `${tempRoot}/pub`, domains: ["site.com"], ssl: true })]);
    const fetchMock = vi.fn(async () => ({ status: 200 }) as never);
    vi.stubGlobal("fetch", fetchMock);
    const res = await exposureService.probe({ target: { id: "r", name: "R" } } as never, `${tempRoot}/pub/.env`);
    expect(res.url).toBe("https://site.com/.env");
    expect(res.status).toBe(200);
    expect(res.accessible).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://site.com/.env", expect.objectContaining({ method: "GET" }));
  });

  it("throws when the file is outside any public root", async () => {
    listSitesMock.mockResolvedValue([site({ root: `${tempRoot}/pub` })]);
    await expect(
      exposureService.probe({ target: { id: "r", name: "R" } } as never, `${tempRoot}/other/.env`),
    ).rejects.toThrow(/raíz pública/);
  });
});

describe("exposureService.blockHtaccess", () => {
  it("snapshots then appends a deny rule", async () => {
    const store = new Map<string, string>();
    const exec = {
      target: { id: "r", name: "R" },
      readFile: vi.fn(async (p: string) => { if (!store.has(p)) throw new Error("ENOENT"); return store.get(p)!; }),
      writeFile: vi.fn(async (p: string, d: string) => { store.set(p, d); }),
    } as never;
    const out = await exposureService.blockHtaccess(exec, `${tempRoot}/pub/.env`);
    expect(out.htaccess).toBe(`${tempRoot}/pub/.htaccess`);
    expect(captureMock).toHaveBeenCalledWith(exec, `${tempRoot}/pub/.htaccess`, "edit");
    expect(store.get(`${tempRoot}/pub/.htaccess`)).toContain("Require all denied");
    expect(store.get(`${tempRoot}/pub/.htaccess`)).toContain('<Files ".env">');
  });
});
