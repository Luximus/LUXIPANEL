import { describe, expect, it } from "vitest";
import { buildMarketplacePromptBlock } from "./marketplace-prompt.js";
import type { MarketplaceLink } from "../../../shared/marketplace-link/index.js";

const LINK: MarketplaceLink = {
  id: "l1",
  projectId: "p1",
  moduleId: "acme-cache-warmer",
  projectPath: "/srv/projects/acme",
  provider: "claude",
};

describe("buildMarketplacePromptBlock", () => {
  it("incluye el slug, el path del proyecto y el projectId", () => {
    const block = buildMarketplacePromptBlock(LINK, { cliMode: true });
    expect(block).toContain("acme-cache-warmer");
    expect(block).toContain("/srv/projects/acme");
    expect(block).toContain("p1");
    expect(block).toContain("modules/acme-cache-warmer/");
  });

  it("incluye las reglas de los campos AUTO del manifest", () => {
    const block = buildMarketplacePromptBlock(LINK, { cliMode: true });
    for (const auto of ["`version`", "`os_compat`", "`arch`", "`path`", "`commit`"]) {
      expect(block).toContain(auto);
    }
    expect(block).toMatch(/NUNCA los inventes/);
  });

  it("incluye el guion de asks del alta (metadatos que decide el dev)", () => {
    const block = buildMarketplacePromptBlock(LINK, { cliMode: true });
    expect(block).toContain("Guion del alta");
    expect(block).toContain("nombre comercial");
    expect(block).toContain("capabilities");
    expect(block).toContain("pricing");
    expect(block).toContain("http_allowlist");
    expect(block).toContain("Pull Request");
    // Límite del ask protocol existente.
    expect(block).toContain("máximo 4 preguntas");
  });

  it("lista las tools module-dev.* del contrato", () => {
    const block = buildMarketplacePromptBlock(LINK, { cliMode: true });
    for (const tool of [
      "module-dev.validate_manifest",
      "module-dev.run_checks",
      "module-dev.run_tests",
      "module-dev.list_modules",
      "module-dev.module_status",
      "module-dev.submit_module",
      "module-dev.resubmit_module",
      "module-dev.unpublish_module",
      "module-dev.republish_module",
      "module-dev.preview_install",
      "module-dev.preview_uninstall",
      "module-dev.link_project",
    ]) {
      expect(block).toContain(tool);
    }
  });

  it("CLI-mode: instruye el bloque centinela ASK y la excepción MCP `luxipanel`", () => {
    const block = buildMarketplacePromptBlock(LINK, { cliMode: true });
    expect(block).toContain("<<<LXP_ASK>>>");
    expect(block).toContain("MCP `luxipanel`");
    expect(block).toContain("EXCEPCIÓN al bloque MODO CLI");
  });

  it("API-mode: sin bloque centinela ni excepción MCP; pregunta en texto plano", () => {
    const block = buildMarketplacePromptBlock(LINK, { cliMode: false });
    expect(block).not.toContain("<<<LXP_ASK>>>");
    expect(block).not.toContain("EXCEPCIÓN al bloque MODO CLI");
    expect(block).toContain("texto");
    expect(block).toContain("modo API");
  });
});
