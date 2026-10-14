// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../remote-cache/conn.js", () => ({
  getRemoteCacheConn: vi.fn(),
}));

import { getRemoteCacheConn } from "../remote-cache/conn.js";
import {
  readCachedDir,
  writeCachedDir,
  invalidateDir,
  readCachedDirSize,
  writeCachedDirSize,
  readCachedFileContent,
  writeCachedFileContent,
  invalidateFile,
  readCachedStat,
  writeCachedStat,
  invalidateStat,
  readCachedSearch,
  writeCachedSearch,
  _internal,
} from "./index.js";

const FAKE_CONN = { host: "127.0.0.1", port: 7379, password: "secret" };

function makeExecutor(execImpl: (cmd: string) => Promise<{ stdout: string; stderr: string }>) {
  return {
    target: { id: "tgt-1" },
    // execWithRedisAuth stages REDISCLI_AUTH in a 0600 tmp file (SFTP) then
    // sources it before the redis-cli command, so the executor must expose
    // writeFile/unlink. The captured `cmd` is the `. <tmp>; <inner>` shell;
    // the inner redis command remains a substring (assertions still match).
    writeFile: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined),
    exec: vi.fn(execImpl),
  } as unknown as Parameters<typeof readCachedDir>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRemoteCacheConn).mockResolvedValue(FAKE_CONN);
});

describe("files-cache", () => {
  describe("hashing + keys", () => {
    it("produces a 16-char hex hash and a namespaced key", () => {
      const h = _internal.hashPath("/var/www");
      expect(h).toMatch(/^[0-9a-f]{16}$/);
      expect(_internal.keyFor("/var/www")).toBe(`lprc:v1:files:dir:${h}`);
    });

    it("derives parent dir correctly for root and nested paths", () => {
      expect(_internal.parentDir("/")).toBe("/");
      expect(_internal.parentDir("/var")).toBe("/");
      expect(_internal.parentDir("/var/www")).toBe("/var");
      expect(_internal.parentDir("/var/www/")).toBe("/var");
      expect(_internal.parentDir("/var/www/site/index.html")).toBe("/var/www/site");
    });
  });

  describe("readCachedDir", () => {
    it("returns null when conn.json is not available (fail-open)", async () => {
      vi.mocked(getRemoteCacheConn).mockResolvedValue(null);
      const exec = makeExecutor(async () => ({ stdout: "", stderr: "" }));
      const result = await readCachedDir(exec, "/var/www");
      expect(result).toBeNull();
    });

    it("returns null on cache miss (redis-cli returns (nil))", async () => {
      const exec = makeExecutor(async () => ({ stdout: "(nil)", stderr: "" }));
      const result = await readCachedDir(exec, "/var/www");
      expect(result).toBeNull();
    });

    it("returns parsed rows on cache hit", async () => {
      // Bake the payload the way writeCachedDir would.
      const rows = [{ name: "index.html", type: "file" }];
      const { gzipSync } = await import("node:zlib");
      const b64 = gzipSync(Buffer.from(JSON.stringify(rows), "utf-8"), { level: 6 }).toString("base64");
      const exec = makeExecutor(async () => ({ stdout: `"${b64}"`, stderr: "" }));
      const result = await readCachedDir(exec, "/var/www");
      expect(result).toEqual(rows);
    });

    it("fails open on exec error", async () => {
      const exec = makeExecutor(async () => { throw new Error("ssh hung"); });
      const result = await readCachedDir(exec, "/var/www");
      expect(result).toBeNull();
    });
  });

  describe("writeCachedDir", () => {
    it("issues a SET with TTL when entries fit the cap", async () => {
      let captured = "";
      const exec = makeExecutor(async (cmd) => {
        captured = cmd;
        return { stdout: "OK", stderr: "" };
      });
      await writeCachedDir(exec, "/var/www", [{ name: "a", type: "file" }]);
      expect(captured).toContain("SET");
      expect(captured).toContain("EX 60");
      expect(captured).toContain("lprc:v1:files:dir:");
    });

    it("skips silently for over-sized directories", async () => {
      const exec = makeExecutor(async () => ({ stdout: "OK", stderr: "" }));
      const huge = new Array(6_000).fill({ name: "x", type: "file" });
      await writeCachedDir(exec, "/var/www", huge);
      expect(exec.exec).not.toHaveBeenCalled();
    });
  });

  describe("dir-size cache", () => {
    it("returns null on miss", async () => {
      const exec = makeExecutor(async () => ({ stdout: "(nil)", stderr: "" }));
      expect(await readCachedDirSize(exec, "/var/www")).toBeNull();
    });

    it("parses a numeric hit", async () => {
      const exec = makeExecutor(async () => ({ stdout: '"123456"', stderr: "" }));
      expect(await readCachedDirSize(exec, "/var/www")).toBe(123456);
    });

    it("writes a SET with the longer dir-size TTL", async () => {
      let captured = "";
      const exec = makeExecutor(async (cmd) => {
        captured = cmd;
        return { stdout: "OK", stderr: "" };
      });
      await writeCachedDirSize(exec, "/var/www", 4096);
      expect(captured).toContain("lprc:v1:files:dir-size:");
      expect(captured).toMatch(/EX 300/);
    });

    it("rejects negative or NaN sizes", async () => {
      const exec = makeExecutor(async () => ({ stdout: "OK", stderr: "" }));
      await writeCachedDirSize(exec, "/var/www", -1);
      await writeCachedDirSize(exec, "/var/www", Number.NaN);
      expect(exec.exec).not.toHaveBeenCalled();
    });
  });

  describe("file content cache", () => {
    it("round-trips a small text file", async () => {
      const { gzipSync } = await import("node:zlib");
      const content = "hello world\nline two\n";
      const b64 = gzipSync(Buffer.from(content, "utf-8"), { level: 6 }).toString("base64");
      const exec = makeExecutor(async () => ({ stdout: `"${b64}"`, stderr: "" }));
      expect(await readCachedFileContent(exec, "/etc/hosts")).toBe(content);
    });

    it("skips writing files over the byte cap", async () => {
      const exec = makeExecutor(async () => ({ stdout: "OK", stderr: "" }));
      const big = "x".repeat(300_000);
      await writeCachedFileContent(exec, "/var/log/huge.log", big);
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it("invalidateFile DELs the file key", async () => {
      let captured = "";
      const exec = makeExecutor(async (cmd) => {
        captured = cmd;
        return { stdout: "(integer) 1", stderr: "" };
      });
      await invalidateFile(exec, "/etc/hosts");
      expect(captured).toMatch(/DEL/);
      expect(captured).toContain(_internal.fileKeyFor("/etc/hosts"));
    });
  });

  describe("stat cache", () => {
    it("round-trips a JSON stat blob", async () => {
      const { gzipSync } = await import("node:zlib");
      const info = { name: "index.html", size: 42, mode: "0644", isDir: false };
      const b64 = gzipSync(Buffer.from(JSON.stringify(info), "utf-8"), { level: 6 }).toString("base64");
      const exec = makeExecutor(async () => ({ stdout: `"${b64}"`, stderr: "" }));
      expect(await readCachedStat(exec, "/var/www/index.html")).toEqual(info);
    });

    it("write goes to the stat-namespaced key", async () => {
      let captured = "";
      const exec = makeExecutor(async (cmd) => {
        captured = cmd;
        return { stdout: "OK", stderr: "" };
      });
      await writeCachedStat(exec, "/var/www/index.html", { size: 1 });
      expect(captured).toContain("lprc:v1:files:stat:");
      expect(captured).toMatch(/EX 60/);
    });

    it("invalidateStat DELs the stat key", async () => {
      let captured = "";
      const exec = makeExecutor(async (cmd) => {
        captured = cmd;
        return { stdout: "(integer) 1", stderr: "" };
      });
      await invalidateStat(exec, "/var/www/index.html");
      expect(captured).toMatch(/DEL/);
      expect(captured).toContain(_internal.statKeyFor("/var/www/index.html"));
    });
  });

  describe("search cache", () => {
    it("(path, query) produces distinct keys", () => {
      const a = _internal.searchKeyFor("/var/www", "foo");
      const b = _internal.searchKeyFor("/var/www", "bar");
      const c = _internal.searchKeyFor("/var/log", "foo");
      expect(a).not.toBe(b);
      expect(a).not.toBe(c);
      expect(b).not.toBe(c);
    });

    it("returns null on miss; array on hit", async () => {
      const { gzipSync } = await import("node:zlib");
      const rows = [{ name: "a.txt", path: "/var/www/a.txt" }];
      const b64 = gzipSync(Buffer.from(JSON.stringify(rows), "utf-8"), { level: 6 }).toString("base64");
      const exec = makeExecutor(async (cmd) =>
        cmd.includes("(nil)") ? { stdout: "(nil)", stderr: "" } : { stdout: `"${b64}"`, stderr: "" },
      );
      expect(await readCachedSearch(exec, "/var/www", "x")).toEqual(rows);
    });

    it("write goes to the search-namespaced key", async () => {
      let captured = "";
      const exec = makeExecutor(async (cmd) => {
        captured = cmd;
        return { stdout: "OK", stderr: "" };
      });
      await writeCachedSearch(exec, "/var/www", "foo", [{ x: 1 }]);
      expect(captured).toContain("lprc:v1:files:search:");
      expect(captured).toMatch(/EX 60/);
    });
  });

  describe("invalidateDir", () => {
    it("DELs the target key and its parent in one exec", async () => {
      let captured = "";
      const exec = makeExecutor(async (cmd) => {
        captured = cmd;
        return { stdout: "(integer) 2", stderr: "" };
      });
      await invalidateDir(exec, "/var/www/site/index.html");
      expect(captured).toMatch(/DEL/);
      const fileKey = _internal.keyFor("/var/www/site/index.html");
      const parentKey = _internal.keyFor("/var/www/site");
      expect(captured).toContain(fileKey);
      expect(captured).toContain(parentKey);
    });

    it("is fail-open when conn.json is missing", async () => {
      vi.mocked(getRemoteCacheConn).mockResolvedValue(null);
      const exec = makeExecutor(async () => ({ stdout: "OK", stderr: "" }));
      await expect(invalidateDir(exec, "/var/www")).resolves.toBeUndefined();
      expect(exec.exec).not.toHaveBeenCalled();
    });
  });
});
