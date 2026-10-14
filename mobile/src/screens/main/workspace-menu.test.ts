import { describe, expect, it } from "vitest";
import { workspaceMenuIds } from "./workspace-menu";

describe("menú del workspace", () => {
  it("respeta el orden guardado, la visibilidad y el acceso sin duplicar herramientas", () => {
    const access = new Set(["assistant", "terminal", "files", "users", "modules", "settings", "project-map", "preferences"]);
    expect(workspaceMenuIds([
      { id: "assistant" }, { id: "users" }, { id: "modules" },
      { id: "files", showInSidebar: false }, { id: "terminal" },
      { id: "settings" }, { id: "firewall" }, { id: "users" },
    ], access)).toEqual(["users", "terminal"]);
  });
});
