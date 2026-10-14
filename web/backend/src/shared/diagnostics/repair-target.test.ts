import { describe, expect, it } from "vitest";
import { repairTarget, requiredChecks } from "./repair-target.js";
describe("repair contribution routing", () => {
  it("routes clients, shared changes and legacy main configuration", () => {
    expect(repairTarget(["web/backend/src/a.ts"], "main")).toBe("web");
    expect(repairTarget(["desktop/src/a.ts"])).toBe("desktop");
    expect(repairTarget(["mobile/src/a.ts"])).toBe("mobile");
    expect(repairTarget(["web/scripts/a.py"])).toBe("developer");
    expect(repairTarget(["web/a.ts", "desktop/b.ts"])).toBe("developer");
    expect(repairTarget(["web/a.ts"], "developer")).toBe("developer");
  });
  it("rejects mixed module work and incorrect explicit destinations", () => {
    expect(() => repairTarget(["web/modules/test-module/a.ts"])).toThrow("separado");
    expect(() => repairTarget(["desktop/a.ts"], "web")).toThrow("desktop");
    expect(() => repairTarget(["web/a.ts"], "fix/custom")).toThrow("inválido");
  });
  it("always verifies the affected clients", () => {
    expect(requiredChecks("desktop")).toEqual(["desktop-types", "desktop-tests", "desktop-build"]);
    expect(requiredChecks("mobile")).toContain("mobile-types");
    expect(requiredChecks("developer")).toHaveLength(9);
  });
});
