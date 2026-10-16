import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ exec: vi.fn(), state: vi.fn(), build: vi.fn(), branches: vi.fn(), verify: vi.fn(), details: vi.fn() }));
vi.mock("node:fs", () => ({ readFileSync: mocks.build, existsSync: () => false }));
vi.mock("../../../config/env.js", () => ({ env: { LUXIPANEL_INSTALL_ROOT: "/panel", LOG_LEVEL: "silent", NODE_ENV: "test" } }));
vi.mock("../../../config/version.js", () => ({ APP_VERSION: "2.0.3" }));
vi.mock("../../../shared/executor/index.js", () => ({ localExecutor: { exec: mocks.exec, readFile: mocks.state }, quoteArg: (s: string) => `'${s}'` }));
vi.mock("./release-branches.service.js", () => ({ releaseBranches: mocks.branches, verifyBranchRevision: mocks.verify, releaseBranchDetails: mocks.details }));
const built = "a".repeat(40), head = "b".repeat(40);
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  mocks.build.mockReturnValue(JSON.stringify({ commit: built })); mocks.state.mockResolvedValue("{}");
  mocks.exec.mockResolvedValue({ exitCode: 0, stdout: `${head}\ndeveloper\n`, stderr: "" });
  mocks.branches.mockResolvedValue({ branches: [] });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
});
describe("installation status", () => {
  it("compares with the built revision even when the checkout has advanced", async () => {
    const { releasesService } = await import("./releases.service.js");
    const status = await releasesService.status();
    expect(mocks.branches).toHaveBeenCalledWith(built); expect(status.checkout?.commit).toBe(head);
    expect(status.installed).toBeNull(); expect(status.comparisonKnown).toBe(true);
    mocks.build.mockReturnValue(JSON.stringify({ commit: head }));
    await releasesService.status(); expect(mocks.branches).toHaveBeenLastCalledWith(built);
  });
  it("uses the verified installation record when available", async () => {
    mocks.state.mockResolvedValue(JSON.stringify({ installed: { commit: head, branch: "developer" } }));
    const { releasesService } = await import("./releases.service.js");
    const status = await releasesService.status(); expect(mocks.branches).toHaveBeenCalledWith(head);
    expect(status.installed?.branch).toBe("developer");
  });
  it("does not treat an unregistered checkout as an installed build", async () => {
    mocks.build.mockImplementation(() => { throw new Error("missing metadata"); });
    const { releasesService } = await import("./releases.service.js");
    expect((await releasesService.status()).comparisonKnown).toBe(false);
    expect(mocks.branches).toHaveBeenCalledWith(undefined);
  });
  it("preserves source edits while allowing runtime dist symlinks in preflight", async () => {
    const { releasesService } = await import("./releases.service.js");
    mocks.exec.mockResolvedValue({ exitCode: 0, stdout: "?? web/backend/dist\n?? web/frontend/dist\n M web/frontend/src/source.tsx\n", stderr: "" });
    expect(await releasesService.preflight()).toEqual({ ok: false, changedFiles: ["web/frontend/src/source.tsx"] });
  });
});

it("validates branch updates against the installed revision before launching the installer", async () => {
  mocks.state.mockResolvedValue(JSON.stringify({ installed: { commit: built, branch: "developer" } }));
  mocks.verify.mockRejectedValueOnce(new Error("La rama no conserva todas las mejoras instaladas"));
  const { releasesService } = await import("./releases.service.js");
  await expect(releasesService.start({} as never, "", { name: "main", commit: head })).rejects.toThrow("no conserva");
  expect(mocks.verify).toHaveBeenCalledExactlyOnceWith("main", head, built);
  expect(mocks.exec).not.toHaveBeenCalled();
  expect(mocks.details).not.toHaveBeenCalled();
});
it("uses the running artifact when installation metadata is absent", async () => {
  mocks.verify.mockResolvedValue(undefined);
  mocks.details.mockResolvedValue({ installable: true });
  mocks.exec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
  const { releasesService } = await import("./releases.service.js");
  await releasesService.start({} as never, "", { name: "developer", commit: head });
  expect(mocks.verify).toHaveBeenCalledExactlyOnceWith("developer", head, built);
  expect(mocks.exec.mock.calls.at(-1)?.[0]).toContain("--branch");
});
