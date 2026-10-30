import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import staticForm from "./__fixtures__/luxisoft-static-form.json";
vi.mock("../../../config/env.js", () => ({ env: { NODE_ENV: "test" } }));
vi.mock("../../../shared/logger/index.js", () => ({ createModuleLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) }));
const m = vi.hoisted(() => ({
  owned: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
  exists: vi.fn(),
  exec: vi.fn(),
  stat: vi.fn(),
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
    m.stat,
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
      stat: m.stat,
    },
  });
});
describe("repository provider ownership and immutable snapshots", () => {
  it("accepts and preserves the actual Luxisoft static form + API deployment contract", async () => {
    const input = deploymentSnapshotSchema.parse(staticForm);
    expect(input).toEqual(staticForm);
    await service.snapshot(provider, account, project, version, input);
    expect(JSON.parse(m.write.mock.calls[0]![1])).toEqual(staticForm);
  });
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
  it("accepts only a bounded, versioned execution budget", () => {
    const input = { requestId: account, versionId: version, environment: "preview", variables: {} };
    expect(deploymentJobSchema.safeParse({ ...input, executionBudget: { version: 1, maxExecutionSeconds: 900 } }).success).toBe(true);
    for (const maxExecutionSeconds of [0, 1901, 1.5, "900"]) {
      expect(deploymentJobSchema.safeParse({ ...input, executionBudget: { version: 1, maxExecutionSeconds } }).success).toBe(false);
    }
    expect(deploymentJobSchema.safeParse({ ...input, executionBudget: { version: 2, maxExecutionSeconds: 900 } }).success).toBe(false);
  });
});

describe("private static artifact transfer", () => {
  const bytes = Buffer.from("fixture static ZIP bytes"), sha256 = createHash("sha256").update(bytes).digest("hex");
  const state = () => ({ status: "finished", versionId: version, result: { components: [
    { name: "forms", surface: "static", port: null, staticArchive: { sha256, bytes: bytes.length } },
  ] } });
  beforeEach(() => {
    m.exists.mockResolvedValue(true);
    m.read.mockImplementation(async (file: string) => file.endsWith("state.json") ? JSON.stringify(state()) : bytes);
    m.stat.mockResolvedValue({ type: "file", size: bytes.length });
  });
  it("returns only verified staged bytes and never reads the tenant home", async () => {
    expect(await service.staticArtifact(provider, account, project, version, "forms")).toEqual({ bytes, sha256 });
    expect(m.read).toHaveBeenLastCalledWith(expect.stringMatching(/\/jobs\/[a-f0-9-]+\/static\/forms\.zip$/));
    expect(m.exec).not.toHaveBeenCalled();
  });
  it("enforces provider/account ownership before reading", async () => {
    m.owned.mockRejectedValue(new Error("foreign account"));
    await expect(service.staticArtifact(provider, account, project, version, "forms")).rejects.toThrow("foreign account");
    expect(m.read).not.toHaveBeenCalled();
  });
  it.each(["../secret", "forms.zip", "/etc/passwd", "a/b"])("rejects path input %s", async component => {
    await expect(service.staticArtifact(provider, account, project, version, component)).rejects.toThrow();
    expect(m.owned).not.toHaveBeenCalled();
  });
  it.each(["queued", "running", "failed"])("refuses artifacts from %s jobs", async status => {
    m.read.mockResolvedValue(JSON.stringify({ ...state(), status }));
    await expect(service.staticArtifact(provider, account, project, version, "forms")).rejects.toThrow("no disponible");
    expect(m.stat).not.toHaveBeenCalled();
  });
  it("does not read another component's artifact", async () => {
    await expect(service.staticArtifact(provider, account, project, version, "forms-api")).rejects.toThrow("no disponible");
    expect(m.stat).not.toHaveBeenCalled();
  });
  it.each([{ sha256: "bad", bytes: 1 }, { sha256, bytes: 33554433 }, { sha256, bytes: 0 }])("rejects invalid artifact metadata %j", async meta => {
    const current = state(); current.result.components[0]!.staticArchive = meta;
    m.read.mockResolvedValue(JSON.stringify(current));
    await expect(service.staticArtifact(provider, account, project, version, "forms")).rejects.toThrow("no disponible");
    expect(m.stat).not.toHaveBeenCalled();
  });
  it.each([{ type: "symlink", size: bytes.length }, { type: "file", size: 33554433 }])("rejects unsafe staged files %j", async stat => {
    m.stat.mockResolvedValue(stat);
    await expect(service.staticArtifact(provider, account, project, version, "forms")).rejects.toThrow("inválido");
    expect(m.read).toHaveBeenCalledTimes(1);
  });
  it("rejects bytes that changed after staging", async () => {
    m.read.mockImplementation(async (file: string) => file.endsWith("state.json") ? JSON.stringify(state()) : Buffer.alloc(bytes.length));
    await expect(service.staticArtifact(provider, account, project, version, "forms")).rejects.toThrow("inválido");
  });
  it("retains verified recovery bytes atomically for a published release", async () => {
    m.exists.mockImplementation(async (_executor: unknown, file: string) => file.endsWith("state.json"));
    m.exec.mockResolvedValue({ exitCode: 0 });
    expect(await service.retainStaticArtifact(provider, account, project, version, "forms", bytes)).toEqual({
      retained: true, versionId: version, component: "forms", sha256,
    });
    expect(m.write).toHaveBeenCalledWith(
      expect.stringMatching(/\/releases\/[^/]+\/forms-[a-f0-9]{64}\.zip\.next$/), bytes, { mode: 0o600 },
    );
    expect(m.exec).toHaveBeenCalledWith(expect.stringContaining("mv -f"), { timeoutMs: 5000 });
  });
  it("rejects recovery bytes that do not match immutable job metadata", async () => {
    await expect(service.retainStaticArtifact(provider, account, project, version, "forms", Buffer.from("other")))
      .rejects.toThrow("inválido");
    expect(m.write).not.toHaveBeenCalled();
  });
  it("removes only the requested owned staged artifact, idempotently", async () => {
    expect(await service.deleteStaticArtifact(provider, account, project, version, "forms")).toEqual({ removed: true });
    expect(m.unlink).toHaveBeenCalledWith(expect.stringMatching(/\/jobs\/[a-f0-9-]+\/static\/forms\.zip$/));
    m.unlink.mockClear();
    m.exists.mockImplementation(async (_e, file: string) => file.endsWith("state.json"));
    expect(await service.deleteStaticArtifact(provider, account, project, version, "forms")).toEqual({ removed: true });
    expect(m.unlink).not.toHaveBeenCalled();
  });
});

describe("durable production routes", () => {
  const requestId = "00000000-0000-4000-8000-000000000004";
  beforeEach(() => {
    m.exists.mockResolvedValue(false);
    m.exec.mockResolvedValue({ exitCode: 0 });
    m.read.mockImplementation(async (file: string) => file.endsWith("state.json")
      ? JSON.stringify({ status: "finished", environment: "production", versionId: version,
          result: { versionId: version, components: [{ name: "app", surface: "http", port: 18080 }] } })
      : JSON.stringify(snapshot()));
  });
  it("atomically materializes only provider-local routing metadata", async () => {
    const result = await service.replaceProductionRoutes(provider, account, project, {
      requestId, versionId: version, versionNumber: 4,
      hosts: [{ hostname: "demo.luxisoft.com", defaultComponent: "app" }],
    });
    expect(result).toMatchObject({ versionId: version, hosts: 1 });
    const write = m.write.mock.calls.find(([file]) => String(file).endsWith("routes.json.next"));
    expect(write).toBeTruthy();
    const route = JSON.parse(String(write![1]));
    expect(route.components).toEqual([{ name: "app", surface: "http", port: 18080, routePrefix: null }]);
    expect(JSON.stringify(route)).not.toMatch(/password|secret|database_url/i);
    expect(m.exec).toHaveBeenCalledWith(expect.stringContaining("routes.json.next"), { timeoutMs: 5000 });
  });
  it("does not replace the active route for an unfinished publication", async () => {
    m.read.mockImplementation(async (file: string) => file.endsWith("state.json")
      ? JSON.stringify({ status: "running", environment: "production", versionId: version })
      : JSON.stringify(snapshot()));
    await expect(service.replaceProductionRoutes(provider, account, project, {
      requestId, versionId: version, versionNumber: 4,
      hosts: [{ hostname: "demo.luxisoft.com", defaultComponent: "app" }],
    })).rejects.toThrow("no preparada");
    expect(m.write).not.toHaveBeenCalled();
  });
});

describe("trusted runtime usage", () => {
  it.each(["finished", "failed"])("returns supervisor usage for %s jobs", async status => {
    m.exists.mockResolvedValue(true);
    m.read.mockResolvedValue(JSON.stringify({ id: version, versionId: version, environment: "preview", status, usage: { executionSeconds: 17 }, createdAt: new Date().toISOString() }));
    const result = await service.job(provider, account, project, version);
    expect(result.usage).toEqual({ executionSeconds: 17 });
  });
});
