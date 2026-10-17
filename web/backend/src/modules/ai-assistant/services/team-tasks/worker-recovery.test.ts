// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, expect, it, vi } from "vitest";
import type { Executor } from "../../../../shared/executor/index.js";
const state = vi.hoisted(() => ({
  get: vi.fn(), recover: vi.fn(), user: { userId: 7, username: "owner" },
}));
vi.mock("../../repositories/cli-jobs.repository.js", () => ({ cliJobsRepository: { get: state.get } }));
vi.mock("../cli-run-recovery.service.js", () => ({ recoverConversation: state.recover }));
vi.mock("../../../../shared/executor/context.js", () => ({ getContextUser: () => state.user }));
import { preserveWorkerExecution } from "./worker-recovery.js";
const executor = { target: { id: "target" } } as Executor;
beforeEach(() => { vi.resetAllMocks(); state.get.mockResolvedValue({ conversationId: "worker" }); state.recover.mockResolvedValue(true); });
it("reattaches the persisted worker with the current owner and target before declaring it orphaned", async () => {
 expect(await preserveWorkerExecution(executor, "worker")).toBe(true);
 expect(state.recover).toHaveBeenCalledWith(executor, "worker", state.user);
});
it("allows normal orphan reconciliation when no persisted execution exists", async () => {
 state.get.mockResolvedValue(null);
 expect(await preserveWorkerExecution(executor, "worker")).toBe(false); expect(state.recover).not.toHaveBeenCalled();
});
it("keeps a worker pending when its target did not confirm the result", async () => {
 state.recover.mockResolvedValue(false);
 expect(await preserveWorkerExecution(executor, "worker")).toBe(true);
});
it("allows reconciliation after confirmed artifact loss removed the descriptor", async () => {
 state.recover.mockResolvedValue(false); state.get.mockResolvedValueOnce({ conversationId: "worker" }).mockResolvedValueOnce(null);
 expect(await preserveWorkerExecution(executor, "worker")).toBe(false);
});
it.each(["read", "recovery"])("does not mark a worker failed after an unconfirmed %s", async stage => {
 if (stage === "read") state.get.mockRejectedValue(new Error("timeout")); else state.recover.mockRejectedValue(new Error("connection unavailable"));
 expect(await preserveWorkerExecution(executor, "worker")).toBe(true);
});
