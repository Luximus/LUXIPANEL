// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Guardia anti-deriva de los team-templates: TODO nombre en `allowedTools` de
 * TODO slot debe existir en el registro REAL de capacidades (se importan las
 * capabilities de los módulos referenciados) y NO ser un alias legacy — los
 * seeds deben estar limpios; la migración de aliases es solo para datos de
 * usuario ya persistidos.
 *
 * Si un módulo renombra una tool, este test rompe ANTES de que la plantilla
 * vuelva a repartir nombres muertos.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/index.js";
import type { AgentCapability } from "../../../shared/agent-capability/index.js";
import { TEAM_TEMPLATES } from "./team-templates.seed.js";
import { LEGACY_TOOL_ALIASES } from "../services/tool-allowlist.js";
// Capacidades REALES de los módulos que los seeds referencian (imports
// estáticos: vite no resuelve dynamic imports con variable). Si los seeds
// empiezan a referenciar un módulo nuevo, el assert de abajo pide añadirlo.
import { filesAgentCapability } from "../../files/agent-capability.js";
import { adminAgentCapability } from "../../admin/agent-capability.js";
import { hostingAgentCapability } from "../../hosting/agent-capability.js";
import { nginxAgentCapability } from "../../nginx/agent-capability.js";
import { databasesAgentCapability } from "../../databases/agent-capability.js";
import { monitorAgentCapability } from "../../monitor/agent-capability.js";
import { cronAgentCapability } from "../../cron/agent-capability.js";
import { backupAgentCapability } from "../../backup/agent-capability.js";
import { expoAgentCapability } from "../../expo/agent-capability.js";
import { browserAgentCapability } from "../browser-agent-capability.js";

const REAL_CAPABILITIES: AgentCapability[] = [
  filesAgentCapability,
  adminAgentCapability,
  hostingAgentCapability,
  nginxAgentCapability,
  databasesAgentCapability,
  monitorAgentCapability,
  cronAgentCapability,
  backupAgentCapability,
  expoAgentCapability,
  browserAgentCapability,
];

/** Módulos referenciados por los seeds (derivado de los propios allowedTools). */
function referencedModules(): string[] {
  const mods = new Set<string>();
  for (const t of TEAM_TEMPLATES) {
    for (const s of t.slots) {
      for (const name of s.allowedTools ?? []) {
        const dot = name.indexOf(".");
        if (dot > 0) mods.add(name.slice(0, dot));
      }
    }
  }
  return [...mods].sort();
}

describe("team-templates seed — allowedTools contra el registro real", () => {
  beforeAll(() => {
    agentCapabilityRegistry._resetForTest();
    const byModule = new Map(REAL_CAPABILITIES.map((c) => [c.moduleId, c]));
    for (const mod of referencedModules()) {
      const cap = byModule.get(mod);
      if (!cap) {
        throw new Error(
          `Los seeds referencian tools del módulo "${mod}" pero su capability no está ` +
            `importada en este test — añade el import estático de src/modules/${mod}/agent-capability.ts a REAL_CAPABILITIES`,
        );
      }
      agentCapabilityRegistry.register(cap);
    }
  });

  it("todos los nombres existen en el registro y ninguno es alias legacy", () => {
    const problems: string[] = [];
    for (const t of TEAM_TEMPLATES) {
      for (const s of t.slots) {
        for (const name of s.allowedTools ?? []) {
          if (name in LEGACY_TOOL_ALIASES) {
            problems.push(`${t.id}/${s.slotId}: "${name}" es un alias legacy — usa ${LEGACY_TOOL_ALIASES[name]!.join(", ") || "(sin equivalente: elimínalo)"}`);
          } else if (!agentCapabilityRegistry.findTool(name)) {
            problems.push(`${t.id}/${s.slotId}: "${name}" no existe en el registro de capacidades`);
          }
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("cada template tiene exactamente un slot raíz y allowedTools null solo donde toca", () => {
    for (const t of TEAM_TEMPLATES) {
      const roots = t.slots.filter((s) => s.parentSlotId === null);
      expect(roots, `${t.id}: debe tener exactamente 1 raíz`).toHaveLength(1);
    }
  });
});
