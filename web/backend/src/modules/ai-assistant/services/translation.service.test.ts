// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import { translationService } from "./translation.service.js";
import { detectLanguageHeuristic, isLikelyEnglish } from "./translation/lang-detect.js";

const { maskCode, restoreCode, translateByCodeSegments } = translationService._internal;

// A fake engine that DROPS any ⟦LXP⟧ sentinel it's handed and upper-cases prose
// so we can assert which fragments were actually translated (some MT engines
// strip placeholder tokens — the code-segment splitter must not rely on them).
const sentinelDroppingProvider = {
  id: "libretranslate" as const,
  async translate(text: string) {
    return text.replace(/⟦LXP\d+⟧/g, "").toUpperCase();
  },
  async ping() {
    return { ok: true };
  },
};

describe("translation code masking", () => {
  it("masks fenced and inline code, restores verbatim", () => {
    const text = "Revisa esto:\n```bash\nrm -rf /tmp/x\n```\ny luego `systemctl restart nginx` por favor.";
    const { masked, spans } = maskCode(text);
    expect(spans).toHaveLength(2);
    expect(masked).not.toContain("rm -rf");
    expect(masked).not.toContain("systemctl");
    expect(masked).toContain("⟦LXP0⟧");
    expect(masked).toContain("⟦LXP1⟧");

    const { restored, ok } = restoreCode(masked, spans);
    expect(ok).toBe(true);
    expect(restored).toBe(text);
  });

  it("flags integrity failure when a sentinel is dropped", () => {
    const { spans } = maskCode("a `code` b");
    const { ok } = restoreCode("translated without sentinel", spans);
    expect(ok).toBe(false);
  });

  it("handles text with no code", () => {
    const { masked, spans } = maskCode("solo texto plano");
    expect(spans).toHaveLength(0);
    expect(restoreCode(masked, spans).restored).toBe("solo texto plano");
  });
});

describe("code-aware split translation (sentinel-dropping engine path)", () => {
  it("translates prose and keeps code verbatim — no sentinels involved", async () => {
    const text = "Importa `panel/servers.css` y luego usa `.srv-field` aquí.";
    const out = await translateByCodeSegments(sentinelDroppingProvider, text, "es", "en");
    // Code spans survive byte-for-byte even though the engine drops sentinels…
    expect(out).toContain("`panel/servers.css`");
    expect(out).toContain("`.srv-field`");
    // …and the prose around them was actually translated (upper-cased here).
    expect(out).toContain("IMPORTA");
    expect(out).toContain("Y LUEGO USA");
  });

  it("survives a message with MANY inline-code spans (the failing case)", async () => {
    const text =
      "Las clases `.srv-field`, `.srv-label`, `.srv-input` y `.srv-btn` viven en `dashboard/servers.css`.";
    const out = await translateByCodeSegments(sentinelDroppingProvider, text, "es", "en");
    for (const span of ["`.srv-field`", "`.srv-label`", "`.srv-input`", "`.srv-btn`", "`dashboard/servers.css`"]) {
      expect(out).toContain(span);
    }
  });

  it("handles fenced blocks and code-only / no-code inputs", async () => {
    const fenced = "Corre esto:\n```bash\nsystemctl restart nginx\n```\nlisto.";
    const out = await translateByCodeSegments(sentinelDroppingProvider, fenced, "es", "en");
    expect(out).toContain("```bash\nsystemctl restart nginx\n```");
    expect(out).toContain("CORRE ESTO:");

    expect(await translateByCodeSegments(sentinelDroppingProvider, "`only code`", "es", "en")).toBe("`only code`");
    expect(await translateByCodeSegments(sentinelDroppingProvider, "solo texto", "es", "en")).toBe("SOLO TEXTO");
  });
});

describe("language detection heuristic", () => {
  it("detects English", () => {
    expect(detectLanguageHeuristic("How much disk space is left on the server?").lang).toBe("en");
    expect(isLikelyEnglish("Please show me the active systemd services")).toBe(true);
  });

  it("detects Spanish", () => {
    expect(detectLanguageHeuristic("¿Cuánto espacio queda en el disco del servidor?").lang).toBe("es");
    expect(isLikelyEnglish("Hola, necesito revisar los logs de nginx por favor")).toBe(false);
  });

  it("detects non-Latin scripts with high confidence", () => {
    const ru = detectLanguageHeuristic("Сколько места осталось на диске?");
    expect(ru.lang).toBe("ru");
    expect(ru.confidence).toBeGreaterThan(0.8);
  });
});
