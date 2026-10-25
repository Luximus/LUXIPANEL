// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { buildCliModeBlock, buildProjectWorkspaceBlock } from "./blocks.js";

describe("CLI project workspace instructions", () => {
  it("directs source edits to the active workspace and limits module tools to panel modules", () => {
    const prompt = buildCliModeBlock({ sudoAvailable: false });
    expect(prompt).toContain("herramientas `modules.*` administran módulos instalados de LUXIPANEL");
    expect(prompt).toContain("Para cambios de código trabaja sobre los archivos de `cwd`");
    expect(prompt).toContain("Respeta el modo de aprobación seleccionado por el usuario");
  });

  it("does not confuse an app URL or panel chat scope with a mounted workspace", () => {
    const workspace = buildProjectWorkspaceBlock({ path: "/var/www/luxisoft", status: "directorio legible y escribible" });
    const cli = buildCliModeBlock({ sudoAvailable: false });
    expect(workspace).toContain("/var/www/luxisoft");
    expect(workspace).toContain("no significa que falte el workspace");
    expect(cli).toContain("luxisoft.chats.list/read");
    expect(cli).toContain("project.chats.list/read");
  });
});
