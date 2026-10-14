// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { hasMutatingTools } from "./orchestrator.service.js";

const t = (name: string, kind: "read" | "action", dangerous = false) => ({ name, kind, dangerous });

describe("hasMutatingTools (gate de solo-lectura del multi-agente)", () => {
  it("toolset de solo lectura → false", () => {
    expect(hasMutatingTools([t("files.read", "read"), t("monitor.cpu_top", "read")])).toBe(false);
  });

  it("cualquier kind:action → true", () => {
    expect(hasMutatingTools([t("files.read", "read"), t("files.write", "action")])).toBe(true);
  });

  it("dangerous aunque sea read → true", () => {
    expect(hasMutatingTools([t("admin.raro", "read", true)])).toBe(true);
  });

  it("lxp_ask (action inocua allowlisted) no cuenta", () => {
    expect(hasMutatingTools([t("lxp_ask", "action"), t("files.read", "read")])).toBe(false);
  });

  it("toolset vacío → false", () => {
    expect(hasMutatingTools([])).toBe(false);
  });
});
