// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithExecutor } from "../../shared/executor/index.js";
import type { Executor } from "../../shared/executor/index.js";
import {
  browserAgentCapability,
  probeChromium,
  CHROMIUM_INSTALL_HINT,
  _resetBrowserProbeCacheForTest,
} from "./browser-agent-capability.js";

type Rule = { match: (cmd: string) => boolean; stdout?: string; stderr?: string; exitCode?: number };

/** Executor fake: rutea cada exec por substring del comando SIN comillas. */
function makeExecutor(rules: Rule[]): { executor: Executor; calls: string[] } {
  const calls: string[] = [];
  const executor = {
    target: { id: `t-${Math.random().toString(36).slice(2, 8)}` },
    exec: vi.fn(async (rawCmd: string) => {
      const cmd = rawCmd.replace(/'/g, "");
      calls.push(cmd);
      const rule = rules.find((r) => r.match(cmd));
      return {
        stdout: rule?.stdout ?? "",
        stderr: rule?.stderr ?? "",
        exitCode: rule?.exitCode ?? 0,
        durationMs: 1,
      };
    }),
  } as unknown as Executor;
  return { executor, calls };
}

const tool = (name: string) => browserAgentCapability.tools.find((t) => t.name === name)!;

beforeEach(() => {
  _resetBrowserProbeCacheForTest();
});

describe("probeChromium", () => {
  it("detecta el primer binario disponible y cachea (TTL)", async () => {
    const { executor, calls } = makeExecutor([
      { match: (c) => c.includes("command -v"), stdout: "/usr/bin/chromium\n" },
    ]);
    const a = await probeChromium(executor);
    expect(a).toMatchObject({ available: true, binPath: "/usr/bin/chromium" });
    const before = calls.length;
    const b = await probeChromium(executor); // caché — sin exec nuevo
    expect(b.available).toBe(true);
    expect(calls.length).toBe(before);
  });

  it("fail-open: exec que lanza → no disponible, sin throw", async () => {
    const executor = {
      target: { id: "t-err" },
      exec: vi.fn(async () => {
        throw new Error("ssh down");
      }),
    } as unknown as Executor;
    const a = await probeChromium(executor);
    expect(a.available).toBe(false);
  });
});

describe("browser.check", () => {
  it("URL inválida → rechazo sin ejecutar nada", async () => {
    const { executor, calls } = makeExecutor([]);
    const res = await runWithExecutor(executor, () => tool("browser.check").handler({ url: "file:///etc/passwd" }));
    expect(res.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("chromium ausente → hint de instalación con apt", async () => {
    const { executor } = makeExecutor([{ match: (c) => c.includes("command -v"), exitCode: 1 }]);
    const res = await runWithExecutor(executor, () => tool("browser.check").handler({ url: "https://x.test/" }));
    expect(res.ok).toBe(false);
    expect(String(res.output)).toBe(CHROMIUM_INSTALL_HINT);
    expect(CHROMIUM_INSTALL_HINT).toContain("apt-get install -y chromium");
    expect(CHROMIUM_INSTALL_HINT).toContain("admin.bash");
  });

  it("camino feliz: status + título + errores de consola", async () => {
    const { executor, calls } = makeExecutor([
      { match: (c) => c.includes("command -v"), stdout: "/usr/bin/chromium\n" },
      { match: (c) => c.startsWith("curl "), stdout: "200 https://x.test/final" },
      {
        match: (c) => c.includes("--dump-dom"),
        stdout: "<html><head><title>Mi App</title></head><body>hola</body></html>",
        stderr: '[123:456:0702/000000.000:ERROR:CONSOLE(12)] "Uncaught TypeError: x is not a function"',
      },
    ]);
    const res = await runWithExecutor(executor, () => tool("browser.check").handler({ url: "https://x.test/" }));
    expect(res.ok).toBe(true);
    const out = res.output as { httpStatus: number; finalUrl: string; title: string; consoleErrors: string[] };
    expect(out.httpStatus).toBe(200);
    expect(out.finalUrl).toBe("https://x.test/final");
    expect(out.title).toBe("Mi App");
    expect(out.consoleErrors).toHaveLength(1);
    expect(out.consoleErrors[0]).toContain("Uncaught TypeError");
    // Flags server-safe presentes.
    expect(calls.some((c) => c.includes("--headless=new") && c.includes("--no-sandbox"))).toBe(true);
  });
});

describe("browser.screenshot", () => {
  it("construye el comando con window-size y devuelve path + bytes", async () => {
    const { executor, calls } = makeExecutor([
      { match: (c) => c.includes("command -v"), stdout: "/usr/bin/chromium\n" },
      { match: (c) => c.startsWith("mkdir "), exitCode: 0 },
      { match: (c) => c.includes("--screenshot="), exitCode: 0 },
      { match: (c) => c.includes("stat -c"), stdout: "34567\n" },
    ]);
    const res = await runWithExecutor(executor, () =>
      tool("browser.screenshot").handler({ url: "https://x.test/", width: 1440, height: 2000 }),
    );
    expect(res.ok).toBe(true);
    const out = res.output as { path: string; bytes: number; viewport: string };
    expect(out.path).toMatch(/^\/tmp\/lxp-browser\/shot-\d+\.png$/);
    expect(out.bytes).toBe(34567);
    expect(out.viewport).toBe("1440x2000");
    expect(calls.some((c) => c.includes("--window-size=1440,2000"))).toBe(true);
  });

  it("outPath inválido → rechazo", async () => {
    const { executor } = makeExecutor([{ match: (c) => c.includes("command -v"), stdout: "/usr/bin/chromium\n" }]);
    const res = await runWithExecutor(executor, () =>
      tool("browser.screenshot").handler({ url: "https://x.test/", outPath: "/tmp/../etc/x.png" }),
    );
    expect(res.ok).toBe(false);
    expect(String(res.output)).toContain("outPath");
  });

  it("screenshot vacío/no generado → error con la salida de chromium", async () => {
    const { executor } = makeExecutor([
      { match: (c) => c.includes("command -v"), stdout: "/usr/bin/chromium\n" },
      { match: (c) => c.includes("--screenshot="), exitCode: 1, stderr: "cannot open display" },
      { match: (c) => c.includes("stat -c"), exitCode: 1 },
    ]);
    const res = await runWithExecutor(executor, () =>
      tool("browser.screenshot").handler({ url: "https://x.test/" }),
    );
    expect(res.ok).toBe(false);
    expect(String(res.output)).toContain("no se generó");
  });
});

describe("browser.discover_urls", () => {
  const NGINX_CONF = `
server {
    listen 80;
    listen 443 ssl;
    server_name mi-app.com www.mi-app.com;
    root /var/www/mi-app/public;
}
server {
    listen 80;
    server_name api.mi-app.com;
    location / {
        proxy_pass http://127.0.0.1:3100;
    }
}
`;
  const SS_OUT = `LISTEN 0 511 0.0.0.0:8080 0.0.0.0:* users:(("node",pid=1,fd=20))
LISTEN 0 511 127.0.0.1:6379 0.0.0.0:*
LISTEN 0 128 0.0.0.0:22 0.0.0.0:*`;

  it("parsea vhosts + puertos y prioriza los que sirven la ruta del proyecto", async () => {
    const { executor } = makeExecutor([
      { match: (c) => c.includes("sites-enabled"), stdout: NGINX_CONF },
      { match: (c) => c.startsWith("ss "), stdout: SS_OUT },
    ]);
    const res = await runWithExecutor(executor, () =>
      tool("browser.discover_urls").handler({ path: "/var/www/mi-app/.lxp/worktrees/task-9/public" }),
    );
    expect(res.ok).toBe(true);
    const out = res.output as { urls: Array<{ url: string; source: string; matchesPath?: boolean }> };
    const urls = out.urls.map((u) => u.url);
    // https porque el vhost escucha 443; el worktree se normaliza al repo real → matchesPath.
    expect(urls).toContain("https://mi-app.com/");
    expect(out.urls.find((u) => u.url === "https://mi-app.com/")?.matchesPath).toBe(true);
    expect(out.urls[0]?.matchesPath).toBe(true); // ranking: matchesPath primero
    // El proxy_pass local también es candidata; redis(6379) y ssh(22) NO.
    expect(urls).toContain("http://127.0.0.1:3100/");
    expect(urls).toContain("http://127.0.0.1:8080/");
    expect(urls.some((u) => u.includes(":6379") || u.includes(":22/"))).toBe(false);
  });

  it("sin vhosts ni puertos → mensaje accionable (no error)", async () => {
    const { executor } = makeExecutor([]);
    const res = await runWithExecutor(executor, () => tool("browser.discover_urls").handler({}));
    expect(res.ok).toBe(true);
    expect(String(res.output)).toContain("No se encontraron");
  });
});

describe("helpers de descubrimiento", () => {
  it("stripWorktreeSegment normaliza rutas de worktree", async () => {
    const { stripWorktreeSegment } = await import("./browser-agent-capability.js");
    expect(stripWorktreeSegment("/repo/.lxp/worktrees/task-9/web")).toBe("/repo/web");
    expect(stripWorktreeSegment("/repo/.lxp/worktrees/task-9")).toBe("/repo");
    expect(stripWorktreeSegment("/repo/web")).toBe("/repo/web");
  });

  it("parseNginxServers ignora comentarios y server_name _", async () => {
    const { parseNginxServers } = await import("./browser-agent-capability.js");
    const blocks = parseNginxServers("server {\n# server_name comentado.com;\nlisten 80 default_server;\nserver_name _;\nroot /var/www/html;\n}");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.serverNames).toEqual([]);
    expect(blocks[0]!.roots).toEqual(["/var/www/html"]);
  });
});
