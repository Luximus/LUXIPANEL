import { it, expect } from "vitest";
import { compareVersions } from "./version.js";
it("orders stable official releases numerically without treating a downgrade as an update", () => { expect(compareVersions("v2.10.0", "2.9.9")).toBeGreaterThan(0); expect(compareVersions("2.0.0", "v2.0.0")).toBe(0); expect(compareVersions("v1.9.0", "2.0.0")).toBeLessThan(0); });
