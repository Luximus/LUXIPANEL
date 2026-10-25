import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../types/index.js";
import type { Executor } from "../executor/types.js";
import { runWithExecutor } from "../executor/context.js";
import { ServiceUnavailableError } from "../errors/index.js";

const revision = vi.hoisted(() => vi.fn());
vi.mock("../auth/authorization-revision.js", () => ({ authorizationRevision: revision }));

import { applyStepsLive, type MutationStep } from "./submit-mutation.js";

const epochs = new Map<string, string>();
const steps: MutationStep[] = [
  { type: "sh", argv: ["true"] },
  { type: "writeFile", path: "/mail/credential-state", content: "new-state" },
];
function identity(extra: Partial<SessionUser> = {}): SessionUser {
  return { userId: 7, username: "operator", displayName: "Operator", role: "admin", kind: "admin", modules: ["mail"],
    targetId: "active-panel-target", authorizationSourceTargetId: "identity", authorizationRevision: "3", ...extra };
}
function destination(id = "mail") {
  const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  const writeFile = vi.fn().mockResolvedValue(undefined);
  const executor = { target: { id, name: id }, exec, writeFile } as unknown as Executor;
  return { executor, exec, writeFile };
}
beforeEach(() => {
  epochs.clear();
  epochs.set("identity", "3");
  epochs.set("mail", "0");
  revision.mockReset().mockImplementation(async (target: string) => epochs.get(target) ?? "0");
});

describe("mutation authorization source", () => {
  it.each([
    { kind: "admin", source: "local", target: "mail" },
    { kind: "admin", source: "ssh-identity", target: "mail" },
    { kind: "user", source: "identity", target: "mail" },
    { kind: "admin", source: "identity", target: "identity" },
  ] as const)("allows $kind authorized by $source to execute on $target", async ({ kind, source, target }) => {
    epochs.set(source, "3");
    const actor = identity({ kind, authorizationSourceTargetId: source });
    const { executor, exec, writeFile } = destination(target);
    await runWithExecutor(executor, () => applyStepsLive(executor, steps), actor.userId, actor);
    expect(revision.mock.calls).toEqual([[source], [source]]);
    expect(writeFile).toHaveBeenCalledWith("/mail/credential-state", "new-state");
    expect(exec).toHaveBeenCalledWith("true", expect.anything());
  });

  it("accepts revision zero from the identity server", async () => {
    epochs.set("identity", "0");
    const actor = identity({ authorizationRevision: "0" });
    const { executor, writeFile } = destination();
    await runWithExecutor(executor, () => applyStepsLive(executor, steps), actor.userId, actor);
    expect(writeFile).toHaveBeenCalledOnce();
  });

  it("rejects revoked identity grants even when the destination epoch matches the old snapshot", async () => {
    epochs.set("identity", "4");
    epochs.set("mail", "3");
    const actor = identity();
    const { executor, exec, writeFile } = destination();
    await expect(runWithExecutor(executor, () => applyStepsLive(executor, steps), actor.userId, actor))
      .rejects.toThrow("Mutation authorization changed");
    expect(exec).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("cancels remaining steps when grants change during the operation", async () => {
    const actor = identity();
    const { executor, exec, writeFile } = destination();
    exec.mockImplementationOnce(async () => {
      epochs.set("identity", "4");
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    await expect(runWithExecutor(executor, () => applyStepsLive(executor, steps), actor.userId, actor))
      .rejects.toThrow("Mutation authorization changed");
    expect(exec).toHaveBeenCalledOnce();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it.each([
    { authorizationSourceTargetId: undefined },
    { authorizationSourceTargetId: "" },
    { authorizationRevision: undefined },
    { authorizationRevision: "" },
  ])("rejects incomplete authorization metadata: %j", async extra => {
    const actor = identity(extra);
    const { executor, exec, writeFile } = destination();
    await expect(runWithExecutor(executor, () => applyStepsLive(executor, steps), actor.userId, actor))
      .rejects.toThrow("Mutation authorization changed");
    expect(revision).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("does not execute steps if the authorization store is unavailable", async () => {
    revision.mockRejectedValue(new ServiceUnavailableError("Authorization service unavailable"));
    const actor = identity();
    const { executor, exec, writeFile } = destination();
    await expect(runWithExecutor(executor, () => applyStepsLive(executor, steps), actor.userId, actor))
      .rejects.toThrow("Authorization service unavailable");
    expect(exec).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("preserves internal operations without an authenticated actor", async () => {
    const { executor, writeFile } = destination();
    await runWithExecutor(executor, () => applyStepsLive(executor, steps));
    expect(revision).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledOnce();
  });
});
