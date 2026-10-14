import { describe, expect, it, vi } from "vitest";
import { PrivilegeDropExecutor } from "./privilege-drop-executor.js";
import type { Executor } from "./types.js";
function fixture() {
  const calls: Array<{ command: string; options: unknown }> = [];
  const inner = { target: { id: "server" }, exec: vi.fn(async (command: string, options?: unknown) => { calls.push({ command, options }); return { stdout: "", stderr: "", exitCode: 0, durationMs: 0 }; }), writeFile: vi.fn(), rename: vi.fn(), unlink: vi.fn() } as unknown as Executor;
  const executor = new PrivilegeDropExecutor(inner, "customer", "/home/customer"); executor.configureHostingRuntime("customer");
  return { executor, inner, calls };
}
const decode = (command: string) => Buffer.from(command.match(/'([A-Za-z0-9+/=]+)'$/)![1], "base64").toString();
describe("hosting execution boundary", () => {
  it("applies cwd and environment only inside the dropped, jailed command", async () => {
    const { executor, calls } = fixture();
    await executor.exec("printf test", { cwd: "/home/customer/project", env: { LD_PRELOAD: "/home/customer/library.so", SECRET: "$(id); ' quoted" }, timeoutMs: 4000 });
    expect(calls[0].options).toEqual({ timeoutMs: 4000 });
    expect(calls[0].command).toMatch(/^sudo \/usr\/lib\/luxipanel\/hosting-shell --managed 'customer' /);
    const body = decode(calls[0].command); expect(body).toContain("cd -- '/home/customer/project'"); expect(body).toContain("LD_PRELOAD=/home/customer/library.so");
    expect(calls[0].command).not.toContain("LD_PRELOAD");
  });
  it("does not forward an invalid environment to its privileged transport", async () => {
    const { executor, inner } = fixture(); await expect(executor.exec("true", { env: { "BAD NAME": "value" } })).rejects.toThrow("Invalid command environment"); expect(inner.exec).not.toHaveBeenCalled();
  });
  it("executes chunked atomic file writes entirely through the jail", async () => {
    const { executor, inner, calls } = fixture(); await executor.writeFile("/home/customer/config", Buffer.alloc(33000), { mode: 0o600 });
    expect(inner.writeFile).not.toHaveBeenCalled(); expect(inner.rename).not.toHaveBeenCalled(); expect(calls).toHaveLength(5);
    for (const call of calls) expect(call.command).toContain("hosting-shell --managed 'customer'");
    expect(decode(calls[0].command)).toContain("O_NOFOLLOW"); expect(decode(calls[3].command)).toContain("os.replace");
  });
  it("never unwraps a different account's service identity", () => {
    const { executor, inner } = fixture(); expect(executor.trustedServiceExecutorFor("other")).toBeNull(); expect(executor.trustedServiceExecutorFor("customer")).toBe(inner);
  });
});
