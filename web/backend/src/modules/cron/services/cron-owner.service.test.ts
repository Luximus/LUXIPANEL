import { describe, expect, it } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { resolveCronOwner, cronUserLogsRoot, cronUserWrapperPath } from "./cron-owner.service.js";

const user = (kind: SessionUser["kind"], username: string): SessionUser => ({
  userId: 4, username, displayName: username, role: kind, modules: ["cron"], kind,
});
const executor = {
  target: { id: "target", name: "Target" },
  async exec(command: string) {
    const name = /'([a-z0-9_-]+)'$/.exec(command)?.[1] || "";
    const rows: Record<string, string> = { root: "root:x:0:0:root:/root:/bin/bash", alice: "alice:x:1001:1001::/home/alice:/bin/bash", bob: "bob:x:1002:1002::/home/bob:/bin/bash", "alice-child": "alice-child:x:1003:1001::/home/alice/alice-child:/bin/bash" };
    return { stdout: rows[name] || "", stderr: "", exitCode: rows[name] ? 0 : 2, durationMs: 0 };
  },
} as Executor;

describe("Cron Linux owner", () => {
  it("confines ordinary and hosting users to their own account", async () => {
    const alice = await resolveCronOwner(user("user", "alice"), executor);
    expect(alice.username).toBe("alice");
    expect(cronUserLogsRoot(alice)).toBe("/home/alice/.local/state/luxipanel/cron/logs");
    expect(cronUserWrapperPath(alice)).toBe("/home/alice/.local/libexec/luxipanel/lxp-cron-run");
    await expect(resolveCronOwner(user("user", "alice"), executor, "root")).rejects.toThrow();
    await expect(resolveCronOwner(user("user", "alice"), executor, "bob")).rejects.toThrow();
    const hosting = { ...user("hosting", "alice-child"), owner: "alice" };
    expect((await resolveCronOwner(hosting, executor)).direct).toBe(true);
    await expect(resolveCronOwner(hosting, executor, "bob")).rejects.toThrow();
  });

  it("lets an admin select an existing Linux account and defaults to root", async () => {
    expect((await resolveCronOwner(user("admin", "root"), executor)).username).toBe("root");
    expect((await resolveCronOwner(user("admin", "root"), executor, "bob")).username).toBe("bob");
    await expect(resolveCronOwner(user("admin", "root"), executor, "nobody-here")).rejects.toThrow();
  });
  it("keeps a linked sub-user in its own crontab", async () => {
    const current = { ...user("user", "alice-child"), owner: "alice", tenantId: 7 };
    expect(await resolveCronOwner(current, executor)).toMatchObject({ username: "alice-child", direct: true });
    await expect(resolveCronOwner(current, executor, "bob")).rejects.toThrow();
  });
});
