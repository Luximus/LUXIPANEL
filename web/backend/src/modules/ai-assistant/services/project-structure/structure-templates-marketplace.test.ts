import { describe, expect, it } from "vitest";
import {
  getProviderStructure,
  findStructureNode,
  type TemplateContext,
} from "./structure-templates.js";

const SLUG = "acme-cache-warmer";
const CTX: TemplateContext = {
  title: "Cache Warmer",
  path: "/srv/projects/acme",
  moduleSlug: SLUG,
  moduleName: "Cache Warmer",
  sdkVersion: "1.0.0",
};

describe("architecture pack marketplace (structure-templates)", () => {
  it("sin opts (o slug inválido) devuelve la estructura base intacta", () => {
    const base = getProviderStructure("claude");
    expect(base.nodes.some((n) => n.rel.startsWith("modules/"))).toBe(false);
    const bad = getProviderStructure("claude", { marketplace: { moduleSlug: "Bad Slug!" } });
    expect(bad.nodes).toEqual(base.nodes);
  });

  it("con marketplace añade los nodos del módulo con el slug en el rel", () => {
    const def = getProviderStructure("claude", { marketplace: { moduleSlug: SLUG } });
    const rels = def.nodes.map((n) => n.rel);
    expect(rels).toContain(`modules/${SLUG}`);
    expect(rels).toContain(`modules/${SLUG}/module.manifest.json`);
    expect(rels).toContain(`modules/${SLUG}/backend/index.js`);
    expect(rels).toContain(`modules/${SLUG}/frontend`);
    expect(rels).toContain(`modules/${SLUG}/README.md`);
    // No muta la estructura base compartida.
    expect(getProviderStructure("claude").nodes.map((n) => n.rel)).not.toContain(`modules/${SLUG}`);
  });

  it("reglas: claude → .claude/rules/marketplace.md; codex/gemini → MARKETPLACE.md", () => {
    const claude = getProviderStructure("claude", { marketplace: { moduleSlug: SLUG } });
    expect(claude.nodes.map((n) => n.rel)).toContain(".claude/rules/marketplace.md");
    expect(claude.nodes.map((n) => n.rel)).not.toContain("MARKETPLACE.md");
    for (const provider of ["codex", "gemini"] as const) {
      const def = getProviderStructure(provider, { marketplace: { moduleSlug: SLUG } });
      expect(def.nodes.map((n) => n.rel)).toContain("MARKETPLACE.md");
      expect(def.nodes.map((n) => n.rel)).not.toContain(".claude/rules/marketplace.md");
    }
  });

  it("el manifest borrador es JSON válido, con el slug y SIN campos AUTO", () => {
    const node = findStructureNode("claude", `modules/${SLUG}/module.manifest.json`, {
      marketplace: { moduleSlug: SLUG },
    });
    expect(node?.type).toBe("file");
    const manifest = JSON.parse(node!.template!(CTX)) as Record<string, unknown>;
    expect(manifest.id).toBe(SLUG);
    expect(manifest.name).toBe("Cache Warmer");
    expect(manifest.scope).toBe("local");
    expect(manifest.sdk).toBe("^1.0"); // derivado de sdkVersion "1.0.0"
    expect(manifest.entry).toEqual({ backend: "backend/index.js" });
    expect(manifest.pricing).toEqual({ model: "free", tokensPerMonth: 0 });
    expect(manifest.min_specs).toEqual({ cpu: 1, ramMb: 128, diskMb: 50 });
    expect(manifest.capabilities).toEqual([]);
    expect(manifest.chat).toEqual({ version: 1, operations: [{ id: "status", tool: "status", kind: "read", permission: `${SLUG}.read` }] });
    // Campos AUTO: los fija la plataforma — el borrador NO los incluye.
    for (const auto of ["version", "os_compat", "arch", "path", "commit"]) {
      expect(manifest).not.toHaveProperty(auto);
    }
  });

  it("el esqueleto del backend usa defineModule y documenta el prefijo de tools", () => {
    const node = findStructureNode("claude", `modules/${SLUG}/backend/index.js`, {
      marketplace: { moduleSlug: SLUG },
    });
    const content = node!.template!(CTX);
    expect(content).toContain("defineModule((m) => {");
    expect(content).toContain('m.tool("status"');
    expect(content).toContain(`"${SLUG}.status"`); // explica el prefijo autogenerado
    expect(content).toContain("@luxipanel/module-sdk");
    expect(content).toContain(`permission: "${SLUG}.read"`);
  });

  it("las reglas de arquitectura cubren campos AUTO, capabilities y frontend", () => {
    const node = findStructureNode("codex", "MARKETPLACE.md", {
      marketplace: { moduleSlug: SLUG },
    });
    const content = node!.template!(CTX);
    expect(content).toContain("Campos AUTO");
    expect(content).toContain("server.exec");
    expect(content).toContain("http_allowlist");
    expect(content).toContain("astro:page-load");
    expect(content).toContain(`lxp.module("${SLUG}")`);
    expect(content).toContain("edita a mano"); // regla "el dev no edita a mano"
  });

  it("findStructureNode sin opts no conoce los nodos marketplace", () => {
    expect(findStructureNode("claude", `modules/${SLUG}/module.manifest.json`)).toBeUndefined();
  });
});
