import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/api-client", () => ({ api: { get: vi.fn() } }));
import { api } from "@/lib/api-client";
import { readPanelReleasePreflight } from "./panel-releases";

beforeEach(() => vi.clearAllMocks());

it("requests live readiness on every retry and carries the precise blocker", async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ ok: true, status: 200, data: { ok: false, reason: "contribution-review" } })
    .mockResolvedValueOnce({ ok: true, status: 200, data: { ok: true } });
  expect(await readPanelReleasePreflight()).toEqual({ ok: false, reason: "contribution-review" });
  expect(await readPanelReleasePreflight()).toEqual({ ok: true });
  expect(api.get).toHaveBeenCalledTimes(2);
  for (const args of vi.mocked(api.get).mock.calls) expect(args).toEqual(["/api/admin/system/releases/preflight", { fresh: true }]);
});

it("does not treat a failed readiness request as permission to install", async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: false, status: 503, error: "Comprobación no disponible" });
  await expect(readPanelReleasePreflight()).rejects.toThrow("Comprobación no disponible");
});
