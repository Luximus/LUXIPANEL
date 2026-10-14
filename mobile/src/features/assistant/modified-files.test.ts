// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests de la detección pura de "archivos modificados" desde el log de tools.
import { describe, expect, it } from "vitest";
import { extractModifiedFiles, resolveAbsPath } from "./modified-files";
import type { ToolBlock } from "./types";

const tool = (output: string, name = "claude.cli"): ToolBlock => ({ id: "t", name, output });

describe("resolveAbsPath", () => {
  it("acepta rutas absolutas y recorta comillas/decoraciones", () => {
    expect(resolveAbsPath("/var/www/app/src/a.ts")).toBe("/var/www/app/src/a.ts");
    expect(resolveAbsPath('"/tmp/x.txt"')).toBe("/tmp/x.txt");
    expect(resolveAbsPath("/tmp/x.txt (3 líneas)")).toBe("/tmp/x.txt");
    expect(resolveAbsPath("/tmp/x.txt    y más cola")).toBe("/tmp/x.txt");
  });

  it("rechaza relativas, globs y vacíos", () => {
    expect(resolveAbsPath("src/a.ts")).toBeNull(); // sin cwd solo absolutas
    expect(resolveAbsPath("/tmp/*.log")).toBeNull();
    expect(resolveAbsPath("   ")).toBeNull();
    expect(resolveAbsPath("/" + "x".repeat(500))).toBeNull();
  });
});

describe("extractModifiedFiles", () => {
  it("mantiene los archivos modificados en el historial CLI reabierto", () => {
    expect(extractModifiedFiles({ cliHistoryLog: "Write /var/www/site/index.ts\nEdit /var/www/site/config.ts" })).toEqual([
      { path: "/var/www/site/index.ts", kind: "modified" },
      { path: "/var/www/site/config.ts", kind: "modified" },
    ]);
  });
  it("detecta líneas write/edit como modificados (en orden de aparición)", () => {
    const files = extractModifiedFiles({
      tools: [tool("● Write /var/www/app/a.ts\n● Edit /var/www/app/b.ts\n")],
    });
    expect(files).toEqual([
      { path: "/var/www/app/a.ts", kind: "modified" },
      { path: "/var/www/app/b.ts", kind: "modified" },
    ]);
  });

  it("detecta rm/unlink dentro de comandos shell como eliminados", () => {
    const files = extractModifiedFiles({
      tools: [tool("● Bash rm -f /tmp/basura.log /tmp/otro.log && echo ok\n")],
    });
    expect(files).toEqual([
      { path: "/tmp/basura.log", kind: "deleted" },
      { path: "/tmp/otro.log", kind: "deleted" },
    ]);
  });

  it("el último veredicto por ruta gana (write posterior a un rm → modified)", () => {
    const files = extractModifiedFiles({
      tools: [tool("● Bash rm /tmp/f.txt\n● Write /tmp/f.txt\n")],
    });
    expect(files).toEqual([{ path: "/tmp/f.txt", kind: "modified" }]);
  });

  it("limpia códigos ANSI, ignora flags de rm y rutas relativas", () => {
    const files = extractModifiedFiles({
      tools: [tool("\x1b[32m● Write\x1b[0m /var/www/x.ts\n● Bash rm -rf ./relativa /abs/borrado.txt | tee log\n")],
    });
    expect(files).toEqual([
      { path: "/var/www/x.ts", kind: "modified" },
      { path: "/abs/borrado.txt", kind: "deleted" },
    ]);
  });

  it("agrega la salida de VARIOS tools y deduplica por ruta", () => {
    const files = extractModifiedFiles({
      tools: [tool("● Write /a/b.ts"), tool("● Edit /a/b.ts"), { id: "t3", name: "x", output: "" }],
    });
    expect(files).toEqual([{ path: "/a/b.ts", kind: "modified" }]);
  });

  it("sin tools (o sin salida) devuelve lista vacía", () => {
    expect(extractModifiedFiles({})).toEqual([]);
    expect(extractModifiedFiles({ tools: [] })).toEqual([]);
  });

  it("corta en 50 archivos como máximo", () => {
    const out = Array.from({ length: 80 }, (_, i) => `● Write /tmp/f-${i}.ts`).join("\n");
    const files = extractModifiedFiles({ tools: [tool(out)] });
    expect(files).toHaveLength(50);
    expect(files[0]!.path).toBe("/tmp/f-0.ts");
  });
});
