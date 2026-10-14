import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("./panel-palette", () => ({ getActivePalette: () => null }));

import { darkTokens, lightTokens } from "./colors";

describe("acciones de marca", () => {
  it("usa el verde profundo de la acción sólida y los acentos oscuros de la web", () => {
    expect(darkTokens).toMatchObject({
      brand: "#63e6ae",
      brandLight: "#68da60",
      brandGlow: "rgba(104, 218, 96, 0.20)",
      actionPrimary: "#176b52",
    });
    expect(lightTokens.actionPrimary).toBe("#151c2c");
  });
});
