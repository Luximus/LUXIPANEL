// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";

// The module captures ONE child logger at import; child loggers are fresh
// instances, so spying post-import can't intercept it. Mock the factory to a
// shared stub so the audit assertion sees the real `log.info` payload.
const { infoMock } = vi.hoisted(() => ({ infoMock: vi.fn() }));
vi.mock("../logger/index.js", () => ({
  createModuleLogger: () => ({ info: infoMock, warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import {
  canEscalatePrivileges,
  assertCanEscalate,
  auditPrivilegedFileOp,
  __resetEscalationCacheForTests,
} from "./privilege-escalation.js";
import { runWithExecutor } from "../executor/context.js";
import { ForbiddenError } from "../errors/index.js";
import type { Executor } from "../executor/types.js";
import type { SessionUser } from "../types/index.js";

/** Executor whose `id -nG` returns `groups` (exit 0) unless `idExit` overrides
 *  it (non-zero exit / throw), to exercise the fail-closed branch. */
function fakeExecutor(opts: { groups?: string; idExit?: number; idThrows?: boolean } = {}): Executor {
  return {
    target: { id: "srv-1", name: "srv-1" },
    exec: vi.fn(async (cmd: string) => {
      if (cmd.startsWith("id -nG")) {
        if (opts.idThrows) throw new Error("ssh down");
        return { stdout: `${opts.groups ?? ""}\n`, stderr: "", durationMs: 1, exitCode: opts.idExit ?? 0 };
      }
      return { stdout: "", stderr: "", durationMs: 1, exitCode: 0 };
    }),
  } as unknown as Executor;
}

const user = (username: string): SessionUser => ({ userId: 7, username } as unknown as SessionUser);
const asUser = (u: SessionUser | null, exec: Executor, fn: () => Promise<void>): Promise<void> =>
  runWithExecutor(exec, fn, u?.userId, u ?? undefined);

beforeEach(() => {
  __resetEscalationCacheForTests();
  infoMock.mockClear();
});

describe("canEscalatePrivileges", () => {
  it("allows a sudo-group member on the connected server", async () => {
    const exec = fakeExecutor({ groups: "admin sudo dayz" });
    await asUser(user("admin"), exec, async () => {
      expect(await canEscalatePrivileges(exec)).toBe(true);
    });
  });

  it("allows a wheel-group member", async () => {
    const exec = fakeExecutor({ groups: "wheel staff" });
    await asUser(user("root"), exec, async () => {
      expect(await canEscalatePrivileges(exec)).toBe(true);
    });
  });

  it("denies a user NOT in sudo/wheel", async () => {
    const exec = fakeExecutor({ groups: "users dayz web" });
    await asUser(user("dayz"), exec, async () => {
      expect(await canEscalatePrivileges(exec)).toBe(false);
    });
  });

  it("fail-closed when the group read exits non-zero", async () => {
    const exec = fakeExecutor({ idExit: 1 });
    await asUser(user("ghost"), exec, async () => {
      expect(await canEscalatePrivileges(exec)).toBe(false);
    });
  });

  it("fail-closed when the group read throws", async () => {
    const exec = fakeExecutor({ idThrows: true });
    await asUser(user("admin"), exec, async () => {
      expect(await canEscalatePrivileges(exec)).toBe(false);
    });
  });

  it("fail-closed when there is NO user context", async () => {
    const exec = fakeExecutor({ groups: "sudo" });
    // No runWithExecutor scope → getContextUser() is null.
    expect(await canEscalatePrivileges(exec)).toBe(false);
    expect((exec.exec as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("caches a resolved decision (one id -nG per session window)", async () => {
    const exec = fakeExecutor({ groups: "sudo" });
    await asUser(user("admin"), exec, async () => {
      await canEscalatePrivileges(exec);
      await canEscalatePrivileges(exec);
      await canEscalatePrivileges(exec);
    });
    const idCalls = (exec.exec as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).startsWith("id -nG"));
    expect(idCalls).toHaveLength(1);
  });

  it("does NOT cache an unresolved (fail-closed) decision — retries next time", async () => {
    const exec = fakeExecutor({ idExit: 1 });
    await asUser(user("admin"), exec, async () => {
      await canEscalatePrivileges(exec);
      await canEscalatePrivileges(exec);
    });
    const idCalls = (exec.exec as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).startsWith("id -nG"));
    expect(idCalls).toHaveLength(2);
  });
});

describe("assertCanEscalate", () => {
  it("resolves silently for a privileged user", async () => {
    const exec = fakeExecutor({ groups: "sudo" });
    await asUser(user("admin"), exec, async () => {
      await expect(assertCanEscalate(exec, "delete", ["/root/f"])).resolves.toBeUndefined();
    });
  });

  it("throws a 403 ForbiddenError naming the user for a non-privileged user", async () => {
    const exec = fakeExecutor({ groups: "users" });
    await asUser(user("dayz"), exec, async () => {
      const err = await assertCanEscalate(exec, "chmod", ["/root/f"]).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).statusCode).toBe(403);
      expect((err as ForbiddenError).message).toContain("dayz");
    });
  });
});

describe("auditPrivilegedFileOp", () => {
  it("records the REAL panel username (not root / the service user)", async () => {
    const exec = fakeExecutor({ groups: "sudo" });
    await asUser(user("carla"), exec, async () => {
      auditPrivilegedFileOp("delete", ["/root/secret"], true);
    });
    expect(infoMock).toHaveBeenCalledTimes(1);
    const payload = infoMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload["user"]).toBe("carla");
    expect(payload["userId"]).toBe(7);
    expect(payload["op"]).toBe("delete");
    expect(payload["privileged"]).toBe(true);
    expect(payload["ok"]).toBe(true);
  });
});
