import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  owned: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
  exists: vi.fn(),
  exec: vi.fn(),
  redis: { set: vi.fn(), eval: vi.fn() },
}));
vi.mock("../../../config/paths.js", () => ({
  panelConfigDir: () => "/test/config",
}));
vi.mock("../../../shared/redis/index.js", () => ({ getRedis: () => m.redis }));
vi.mock("./provider.service.js", () => ({
  providerService: { ownedAccount: m.owned },
}));
vi.mock("../../../shared/executor/index.js", () => ({
  pathExists: m.exists,
  quoteArg: (value: string) => JSON.stringify(value),
}));
import {
  deploymentProviderService as service,
  deploymentSnapshotSchema,
  deploymentJobSchema,
} from "./deployment-provider.service.js";
const account = "00000000-0000-4000-8000-000000000001",
  project = "00000000-0000-4000-8000-000000000002",
  version = "00000000-0000-4000-8000-000000000003",
  provider = { id: "provider-a" } as never;
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const contents = {
  schemaVersion: 1,
  components: [
    {
      name: "app",
      context: ".",
      surface: "http",
      port: 8080,
      healthPath: "/",
      stack: "static",
      volumes: [],
    },
  ],
  resources: [],
};
function canonical(value: any): string {
  return Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(",")}}`
      : JSON.stringify(value);
}
const snapshot = () =>
  deploymentSnapshotSchema.parse({
    sourceDigest: hash("source"),
    manifest: { ...contents, digest: hash(canonical(contents)) },
  });
beforeEach(() => {
  for (const mock of [
    m.owned,
    m.read,
    m.write,
    m.mkdir,
    m.unlink,
    m.exists,
    m.exec,
    m.redis.set,
    m.redis.eval,
  ])
    mock.mockReset();
  m.redis.set.mockResolvedValue("OK");
  m.exists.mockResolvedValue(false);
  m.owned.mockResolvedValue({
    account: {
      status: "active",
      username: "hp" + "a".repeat(20),
      homeRoot: "/home/hp" + "a".repeat(20),
    },
    executor: {
      readFile: m.read,
      writeFile: m.write,
      mkdir: m.mkdir,
      unlink: m.unlink,
      exec: m.exec,
    },
  });
});
describe("repository provider ownership and immutable snapshots", () => {
  it("checks provider ownership before creating runtime metadata", async () => {
    m.owned.mockRejectedValue(new Error("foreign account"));
    await expect(service.register(provider, account, project)).rejects.toThrow(
      "foreign account",
    );
    expect(m.mkdir).not.toHaveBeenCalled();
  });
  it("does not launch suspended or malformed hosting identities", async () => {
    m.owned.mockResolvedValue({ account: { status: "suspended" } });
    await expect(service.register(provider, account, project)).rejects.toThrow(
      "suspendida",
    );
    expect(m.exec).not.toHaveBeenCalled();
  });
  it("resumes only the owned retired project when the runtime is installed", async () => {
    m.exec.mockResolvedValue({ exitCode: 0 });
    m.exists.mockImplementation(async (_executor, filename) =>
      filename.endsWith("/retire.json"),
    );
    const result = await service.register(provider, account, project);
    expect(result.runtimeInstalled).toBe(true);
    expect(m.write).toHaveBeenCalledWith(
      expect.stringContaining("/resume.json"),
      expect.stringContaining(project),
      { mode: 0o600 },
    );
    expect(m.exec).toHaveBeenCalledWith(expect.stringContaining(" resume"), {
      timeoutMs: 30000,
    });
    expect(m.unlink).toHaveBeenCalledWith(
      expect.stringContaining("/retire.json"),
    );
  });
  it("keeps the retirement marker when resuming fails", async () => {
    m.exec
      .mockResolvedValueOnce({ exitCode: 0 })
      .mockResolvedValueOnce({ exitCode: 1 });
    m.exists.mockResolvedValue(true);
    await expect(service.register(provider, account, project)).rejects.toThrow(
      "deployment_resume_failed",
    );
    expect(m.unlink).not.toHaveBeenCalled();
  });
  it("rejects a manifest changed after approval", async () => {
    const input = snapshot();
    input.manifest.components[0]!.port = 9999;
    await expect(
      service.snapshot(provider, account, project, version, input),
    ).rejects.toThrow("Manifiesto");
    expect(m.write).not.toHaveBeenCalled();
  });
  it("accepts canonical manifests and stores them privately", async () => {
    await service.snapshot(provider, account, project, version, snapshot());
    expect(m.write).toHaveBeenCalledWith(
      expect.stringContaining("/versions/" + version + "/manifest.json"),
      expect.any(String),
      { mode: 0o600 },
    );
  });
  it("refuses to overwrite an immutable version", async () => {
    m.exists.mockResolvedValue(true);
    m.read.mockResolvedValue(
      JSON.stringify({
        sourceDigest: "f".repeat(64),
        manifest: { digest: "e".repeat(64) },
      }),
    );
    await expect(
      service.snapshot(provider, account, project, version, snapshot()),
    ).rejects.toThrow("inmutable");
    expect(m.write).not.toHaveBeenCalled();
  });
  it("rejects host paths and credential broker variables at the boundary", () => {
    expect(
      deploymentSnapshotSchema.safeParse({
        ...snapshot(),
        manifest: {
          ...snapshot().manifest,
          components: [
            { ...snapshot().manifest.components[0], context: "../other" },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      deploymentJobSchema.safeParse({
        requestId: account,
        versionId: version,
        environment: "preview",
        variables: { EXPO_TOKEN: "private" },
      }).success,
    ).toBe(false);
  });
});
