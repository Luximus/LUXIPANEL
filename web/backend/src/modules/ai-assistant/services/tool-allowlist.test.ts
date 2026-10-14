// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it } from "vitest";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/index.js";
import type { AgentCapability } from "../../../shared/agent-capability/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import {
  LEGACY_TOOL_ALIASES,
  normalizeAllowedTools,
  suggestSimilarTools,
} from "./tool-allowlist.js";

function capWithTools(moduleId: string, suffixes: string[]): AgentCapability {
  return {
    moduleId,
    version: 1,
    tools: suffixes.map((s) => ({
      name: `${moduleId}.${s}`,
      title: s,
      description: s,
      kind: "read" as const,
      inputSchema: { type: "object" as const, properties: {}, required: [] },
      handler: async () => ({ ok: true, output: "" }),
    })),
  };
}

function seedRegistry(): void {
  agentCapabilityRegistry.register(capWithTools("files", ["read", "write", "list_dir", "grep", "mkdir"]));
  agentCapabilityRegistry.register(capWithTools("admin", ["bash", "health", "restart_service"]));
  agentCapabilityRegistry.register(capWithTools("cron", ["list", "add", "update", "toggle", "remove"]));
  agentCapabilityRegistry.register(capWithTools("databases", ["run_query", "list_databases", "list_tables"]));
}

describe("normalizeAllowedTools", () => {
  beforeEach(() => {
    agentCapabilityRegistry._resetForTest();
    seedRegistry();
  });

  it("devuelve null para null/undefined (sin restricción)", () => {
    expect(normalizeAllowedTools(null)).toBeNull();
    expect(normalizeAllowedTools(undefined)).toBeNull();
  });

  it("deja pasar nombres registrados y deduplica", () => {
    const norm = normalizeAllowedTools(["files.read", "files.read", "admin.bash"]);
    expect(norm).toEqual({ valid: ["files.read", "admin.bash"], migrated: [], unknown: [] });
  });

  it("migra cada alias legacy a sus reemplazos", () => {
    const norm = normalizeAllowedTools(["files.list", "files.search", "terminal.run", "cron.write"]);
    expect(norm!.valid).toEqual([
      "files.list_dir",
      "files.grep",
      "admin.bash",
      "cron.add",
      "cron.update",
      "cron.toggle",
      "cron.remove",
    ]);
    expect(norm!.migrated.map((m) => m.from)).toEqual([
      "files.list",
      "files.search",
      "terminal.run",
      "cron.write",
    ]);
    expect(norm!.unknown).toEqual([]);
  });

  it("alias sin equivalente (ssl.issue, files.diff) desaparece sin ser unknown", () => {
    const norm = normalizeAllowedTools(["ssl.issue", "files.diff", "files.read"]);
    expect(norm!.valid).toEqual(["files.read"]);
    expect(norm!.migrated).toEqual([
      { from: "ssl.issue", to: [] },
      { from: "files.diff", to: [] },
    ]);
    expect(norm!.unknown).toEqual([]);
  });

  it("alias cuyo reemplazo no está registrado en este build filtra el destino", () => {
    // monitor.* no está registrado en seedRegistry → monitor.read migra a [].
    const norm = normalizeAllowedTools(["monitor.read"]);
    expect(norm!.valid).toEqual([]);
    expect(norm!.migrated).toEqual([{ from: "monitor.read", to: [] }]);
  });

  it("deduplica alias + nombre real del mismo destino", () => {
    const norm = normalizeAllowedTools(["files.list", "files.list_dir"]);
    expect(norm!.valid).toEqual(["files.list_dir"]);
  });

  it("onUnknown=reject lanza ValidationError con sugerencias", () => {
    try {
      normalizeAllowedTools(["files.reed"], { onUnknown: "reject" });
      expect.unreachable("debió lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const details = (err as ValidationError).details;
      expect(details).toHaveLength(1);
      expect(details[0]!.field).toBe("allowedTools");
      expect(details[0]!.message).toContain('"files.reed"');
      expect(details[0]!.message).toContain("files.read");
    }
  });

  it("onUnknown=drop descarta y reporta", () => {
    const norm = normalizeAllowedTools(["files.read", "nope.tool"], { onUnknown: "drop" });
    expect(norm!.valid).toEqual(["files.read"]);
    expect(norm!.unknown).toEqual(["nope.tool"]);
  });

  it("registry vacío → pass-through sin validar (fail-open)", () => {
    agentCapabilityRegistry._resetForTest();
    const norm = normalizeAllowedTools(["files.list", "nope.tool", "nope.tool"], { onUnknown: "reject" });
    expect(norm).toEqual({ valid: ["files.list", "nope.tool"], migrated: [], unknown: [] });
  });

  it("los strings vacíos se ignoran", () => {
    const norm = normalizeAllowedTools(["  ", "files.read"]);
    expect(norm!.valid).toEqual(["files.read"]);
  });
});

describe("suggestSimilarTools", () => {
  beforeEach(() => {
    agentCapabilityRegistry._resetForTest();
    seedRegistry();
  });

  it("sugiere el nombre real más cercano", () => {
    expect(suggestSimilarTools("files.reed")).toContain("files.read");
  });

  it("prioriza el mismo módulo", () => {
    const hints = suggestSimilarTools("files.run_query");
    expect(hints[0]!.startsWith("files.")).toBe(true);
  });

  it("registry vacío → sin sugerencias", () => {
    agentCapabilityRegistry._resetForTest();
    expect(suggestSimilarTools("files.read")).toEqual([]);
  });
});

describe("LEGACY_TOOL_ALIASES", () => {
  it("ningún alias es a la vez un nombre 'vivo' del mapa de destinos", () => {
    const targets = new Set(Object.values(LEGACY_TOOL_ALIASES).flat());
    for (const from of Object.keys(LEGACY_TOOL_ALIASES)) {
      expect(targets.has(from), `${from} aparece como origen y destino`).toBe(false);
    }
  });
});
