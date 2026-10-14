// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

import { describe, it, expect } from "vitest";
import {
  stripAnsi,
  stripMarkdownLite,
  humanizeJsonValue,
  humanizePreview,
} from "./humanize-preview.js";

const ESC = String.fromCharCode(27);

describe("stripAnsi", () => {
  it("quita colores y reposicionamiento de cursor", () => {
    expect(stripAnsi(`${ESC}[32mhecho${ESC}[0m`)).toBe("hecho");
    expect(stripAnsi(`${ESC}[2K${ESC}[1Gtexto`)).toBe("texto");
  });
  it("tolera vacío", () => {
    expect(stripAnsi("")).toBe("");
  });
});

describe("stripMarkdownLite", () => {
  it("quita vallas, backticks, negritas, encabezados y viñetas", () => {
    const md = "## Título\n\n- **uno** con `código`\n- [enlace](https://x.test)\n";
    const out = stripMarkdownLite(md).replace(/\s+/g, " ").trim();
    expect(out).toBe("Título uno con código enlace");
  });
});

describe("humanizeJsonValue", () => {
  it("traduce escalares enumerados y booleanos", () => {
    expect(humanizeJsonValue("medium")).toBe("medio");
    expect(humanizeJsonValue("critical")).toBe("crítico");
    expect(humanizeJsonValue(true)).toBe("sí");
    expect(humanizeJsonValue(7)).toBe("7");
  });
  it("array: 2 primeros + (+N)", () => {
    expect(humanizeJsonValue(["a", "b", "c", "d"])).toBe("a, b (+2)");
    expect(humanizeJsonValue(["a", "b"])).toBe("a, b");
  });
  it("descarta objetos y nulos", () => {
    expect(humanizeJsonValue({ a: 1 })).toBe("");
    expect(humanizeJsonValue(null)).toBe("");
  });
});

describe("humanizePreview — JSON", () => {
  it("resume el JSON real del informe de riesgo", () => {
    const raw = JSON.stringify({
      overallRisk: "medium",
      keyThreats: [
        "BitNinja no está instalado ni activo en el servidor",
        "Puerto 22 abierto a todo internet",
        "Sin 2FA en el panel",
      ],
    });
    const out = humanizePreview(raw, 140);
    expect(out.startsWith("Riesgo: medio · Amenazas: BitNinja")).toBe(true);
    expect(out).not.toContain("{");
    expect(out).not.toContain('"');
  });

  it("como mucho 3 campos, separados por ·", () => {
    const raw = JSON.stringify({
      summary: "Todo listo",
      status: "ok",
      severity: "high",
      recommendations: ["Actualizar"],
      extra: "no debería salir",
    });
    const out = humanizePreview(raw, 200);
    expect(out).toBe("Resumen: Todo listo · Estado: correcto · Severidad: alto");
    expect(out).not.toContain("no debería salir");
  });

  it("camelCase desconocido → palabras", () => {
    expect(humanizePreview('{"nextSteps":"revisar logs"}', 100)).toBe("Next steps: revisar logs");
  });

  it("array JSON de nivel superior", () => {
    expect(humanizePreview('["uno","dos","tres"]', 100)).toBe("uno, dos (+1)");
  });

  it("JSON truncado: repara hasta el último cierre", () => {
    const raw = '{"overallRisk":"high","summary":"revisar firewall"} algo suelto sin cerrar {';
    expect(humanizePreview(raw, 140)).toBe("Riesgo: alto · Resumen: revisar firewall");
  });

  it("JSON roto sin reparación posible: quita llaves y comillas", () => {
    const out = humanizePreview('{"overallRisk": "medium", "keyThreats": [', 140);
    expect(out).not.toContain("{");
    expect(out).not.toContain('"');
    expect(out).toContain("overallRisk");
  });
});

describe("humanizePreview — logs, markdown y texto", () => {
  it("log CLI con ANSI y marcadores de herramienta", () => {
    const raw =
      `${ESC}[2m⏺${ESC}[0m Bash(ls -la)\n` +
      "  ⎿  total 12\n" +
      `${ESC}[1m●${ESC}[0m He revisado el servidor y todo está correcto.\n`;
    const out = humanizePreview(raw, 140);
    expect(out).not.toContain(ESC);
    expect(out).not.toContain("⏺");
    expect(out).not.toContain("⎿");
    expect(out).toContain("He revisado el servidor y todo está correcto.");
  });

  it("markdown plano queda legible", () => {
    expect(humanizePreview("**Listo**: se aplicaron `2` cambios", 140)).toBe(
      "Listo: se aplicaron 2 cambios",
    );
  });

  it("texto plano intacto y espacios colapsados", () => {
    expect(humanizePreview("  hola   mundo \n\n de nuevo ", 140)).toBe("hola mundo de nuevo");
  });

  it("trunca en frontera de palabra con …", () => {
    const out = humanizePreview("palabra ".repeat(50), 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.endsWith("pala…")).toBe(false);
  });

  it("vacío / no-string → cadena vacía", () => {
    expect(humanizePreview("", 140)).toBe("");
    expect(humanizePreview("   \n  ", 140)).toBe("");
    expect(humanizePreview(undefined as unknown as string, 140)).toBe("");
    expect(humanizePreview(42 as unknown as string, 140)).toBe("");
  });
});
