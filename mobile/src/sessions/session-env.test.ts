// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { computeSessionsSuppressed, type SessionOverlayFlags } from "./session-env";

const NONE: SessionOverlayFlags = {
  nativeModuleOpen: false,
  standaloneOpen: false,
  directConnectOpen: false,
  activating: false,
  modulePickerVisible: false,
  actionsSheetVisible: false,
  supportDrawerOpen: false,
};

describe("computeSessionsSuppressed", () => {
  it("sin overlays: las sesiones NO se suprimen", () => {
    expect(computeSessionsSuppressed(NONE)).toBe(false);
  });

  it("cada overlay suprime por sí solo (incluido el sheet central de acciones)", () => {
    // El sheet de acciones faltaba en la condición: las sesiones vivas se
    // pintaban ENCIMA del sheet abierto (regresión de QA).
    for (const flag of Object.keys(NONE) as (keyof SessionOverlayFlags)[]) {
      expect(computeSessionsSuppressed({ ...NONE, [flag]: true })).toBe(true);
    }
  });

  it("varios overlays a la vez siguen suprimiendo", () => {
    expect(
      computeSessionsSuppressed({ ...NONE, actionsSheetVisible: true, supportDrawerOpen: true }),
    ).toBe(true);
  });
});
