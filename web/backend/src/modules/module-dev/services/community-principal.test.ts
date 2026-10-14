import { it, expect, vi } from "vitest";
vi.mock("../../../shared/data-store/index.js", () => ({ dataStore: vi.fn() }));
vi.mock("../../../shared/executor/index.js", () => ({ localExecutor: {} }));
vi.mock("../../../shared/diagnostics/repair-jobs.js", () => ({ repairJobs: {} }));
vi.mock("../../../config/env.js", () => ({ env: {} }));
import { communityPrincipal } from "./community-activity.service.js";
it("keeps local, SSH and tenant read cursors separate even with identical numeric user ids", () => {
 const principal = (extra: unknown) => communityPrincipal({ userId: 1, ...(extra as any) } as any);
 expect(new Set([principal({}), principal({ direct: true, targetId: "A" }), principal({ direct: true, targetId: "B" }), principal({ tenantId: "customer-A", targetId: "A" }), principal({ tenantId: "customer-B", targetId: "A" })]).size).toBe(5);
});
