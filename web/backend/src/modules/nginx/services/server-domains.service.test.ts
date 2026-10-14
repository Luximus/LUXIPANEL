// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { serverDomainsService } from "./server-domains.service.js";
import { Duplex } from "node:stream";
import type { DirEntry, ExecResult, Executor, FileStat } from "../../../shared/executor/index.js";

describe("serverDomainsService._normalizeCandidate", () => {
  it("normalizes valid hostnames", () => {
    expect(serverDomainsService._normalizeCandidate("Example.COM.")).toBe("example.com");
    expect(serverDomainsService._normalizeCandidate("blog.example.com:443")).toBe("blog.example.com");
  });

  it("rejects wildcards and special placeholders", () => {
    expect(serverDomainsService._normalizeCandidate("*.example.com")).toBeNull();
    expect(serverDomainsService._normalizeCandidate("_")).toBeNull();
    expect(serverDomainsService._normalizeCandidate("localhost")).toBeNull();
  });
});

describe("serverDomainsService extractors", () => {
  it("extracts multiple domains from nginx server_name", () => {
    const domains = serverDomainsService._extractFromNginx(`
      server {
        server_name example.com www.example.com api.example.com;
      }
    `);

    expect(domains).toEqual(["example.com", "www.example.com", "api.example.com"]);
  });

  it("extracts nginx document root", () => {
    const root = serverDomainsService._extractNginxDocumentRoot(`
      server {
        server_name example.com;
        root /var/www/example.com/public;
      }
    `);

    expect(root).toBe("/var/www/example.com/public");
  });

  it("ignores nginx acme challenge roots", () => {
    const root = serverDomainsService._extractNginxDocumentRoot(`
      server {
        server_name ssg.example.com;
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
      }
    `);

    expect(root).toBeNull();
  });

  it("extracts domains from apache ServerName and ServerAlias", () => {
    const domains = serverDomainsService._extractFromApache(`
      <VirtualHost *:80>
        ServerName example.com
        ServerAlias www.example.com api.example.com
      </VirtualHost>
    `);

    expect(domains).toEqual(["example.com", "www.example.com", "api.example.com"]);
  });

  it("extracts apache document root", () => {
    const root = serverDomainsService._extractApacheDocumentRoot(`
      <VirtualHost *:80>
        ServerName example.com
        DocumentRoot "/var/www/example.com/html"
      </VirtualHost>
    `);

    expect(root).toBe("/var/www/example.com/html");
  });

  it("extracts hostnames from Caddy-style host lines", () => {
    const domains = serverDomainsService._extractFromCaddy(`
      example.com {
        reverse_proxy 127.0.0.1:3000
      }
    `);

    expect(domains).toEqual(["example.com"]);
  });

  it("extracts caddy document root", () => {
    const root = serverDomainsService._extractCaddyDocumentRoot(`
      example.com {
        root * /var/www/example.com
        file_server
      }
    `);

    expect(root).toBe("/var/www/example.com");
  });

  it("lists discovered domains using a bridged executor target", async () => {
    const files = new Map<string, string>([
      ["/etc/nginx/sites-enabled/panel.conf", `
      server {
        server_name panel.example.com api.example.com;
        root /var/www/panel;
      }
      `],
    ]);
    const directories = new Map<string, string[]>([
      ["/etc/nginx/sites-enabled", ["panel.conf"]],
    ]);

    const fileStat = (filePath: string): FileStat => ({
      name: filePath.split("/").pop() ?? filePath,
      path: filePath,
      type: "file",
      isDir: false,
      size: files.get(filePath)?.length ?? 0,
      mode: "0644",
      mtime: new Date(),
      isReadable: true,
      isWritable: false,
      isHidden: false,
      hasGit: false,
      gitStatus: null,
    });

    const dirEntry = (dirPath: string, name: string): DirEntry => ({
      name,
      path: `${dirPath}/${name}`,
      type: "file",
      isDir: false,
      size: files.get(`${dirPath}/${name}`)?.length ?? 0,
      mode: "0644",
      mtime: new Date(),
      isReadable: true,
      isWritable: false,
      isHidden: false,
      hasGit: false,
      gitStatus: null,
    });

    const mockExecutor: Executor = {
      target: { id: "target-1", name: "Target 1" },
      async exec(): Promise<ExecResult> { throw new Error("not implemented"); },
      async readFile(filePath: string): Promise<string | Buffer> {
        const content = files.get(filePath);
        if (!content) throw new Error("missing file");
        return content;
      },
      async writeFile(): Promise<void> { throw new Error("not implemented"); },
      async readdir(dirPath: string): Promise<DirEntry[]> {
        const entries = directories.get(dirPath);
        if (!entries) throw new Error("missing directory");
        return entries.map((name) => dirEntry(dirPath, name));
      },
      async stat(targetPath: string): Promise<FileStat> {
        if (directories.has(targetPath)) {
          return {
            name: targetPath.split("/").pop() ?? targetPath,
            path: targetPath,
            type: "dir",
            isDir: true,
            size: 0,
            mode: "0755",
            mtime: new Date(),
            isReadable: true,
            isWritable: false,
            isHidden: false,
            hasGit: false,
            gitStatus: null,
          };
        }
        if (files.has(targetPath)) {
          return fileStat(targetPath);
        }
        throw new Error("missing path");
      },
      async mkdir(): Promise<void> { throw new Error("not implemented"); },
      async unlink(): Promise<void> { throw new Error("not implemented"); },
      async rename(): Promise<void> { throw new Error("not implemented"); },
      spawn(): Duplex { throw new Error("not implemented"); },
    };

    const discovered = await serverDomainsService.list(mockExecutor);

    expect(discovered).toEqual([
      {
        name: "api.example.com",
        sources: ["nginx"],
        documentRoot: "/var/www/panel",
        documentRoots: ["/var/www/panel"],
        configPath: "/etc/nginx/sites-enabled/panel.conf",
        configPaths: ["/etc/nginx/sites-enabled/panel.conf"],
      },
      {
        name: "panel.example.com",
        sources: ["nginx"],
        documentRoot: "/var/www/panel",
        documentRoots: ["/var/www/panel"],
        configPath: "/etc/nginx/sites-enabled/panel.conf",
        configPaths: ["/etc/nginx/sites-enabled/panel.conf"],
      },
    ]);
  });
});
