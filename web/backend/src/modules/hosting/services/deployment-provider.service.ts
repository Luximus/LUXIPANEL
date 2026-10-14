import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { panelConfigDir } from "../../../config/paths.js";
import {
  quoteArg,
  pathExists,
  type Executor,
} from "../../../shared/executor/index.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/index.js";
import { providerService } from "./provider.service.js";
import type { HostingProvider } from "../models/provider.model.js";
import { getRedis } from "../../../shared/redis/index.js";

const uuid = z.string().uuid(),
  name = z.string().regex(/^[a-z][a-z0-9-]{0,29}$/);
const relative = z
  .string()
  .max(300)
  .refine(
    (v) =>
      v === "." ||
      (/^[A-Za-z0-9_./@-]+$/.test(v) &&
        !v.startsWith("/") &&
        v.split("/").every((p) => p && p !== "." && p !== "..")),
  );
export const deploymentSnapshotSchema = z
  .object({
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    manifest: z
      .object({
        schemaVersion: z.literal(1),
        digest: z.string().regex(/^[a-f0-9]{64}$/),
        components: z
          .array(
            z
              .object({
                name,
                context: relative,
                surface: z.enum(["http", "worker", "mobile"]),
                port: z.number().int().min(1).max(65535),
                healthPath: z
                  .string()
                  .regex(/^\/[A-Za-z0-9_/?=&.-]*$/)
                  .max(200),
                stack: z.string().max(40),
                dockerfile: relative.optional(),
                recipe: z.string().max(20000).optional(),
                start: z.string().max(2000).optional(),
                build: z.string().max(2000).optional(),
                output: relative.optional(),
                generatedFiles: z
                  .record(z.string(), z.string().max(10000))
                  .refine((files) =>
                    Object.keys(files).every(
                      (p) => p === ".luxisoft-runtime/Caddyfile",
                    ),
                  )
                  .optional(),
                routePrefix: z
                  .string()
                  .regex(/^\/[a-zA-Z0-9_/-]+$/)
                  .max(100)
                  .optional(),
                volumes: z
                  .array(
                    z.object({
                      name,
                      path: z
                        .string()
                        .regex(
                          /^\/(?:app|data|srv|var\/lib)\/[A-Za-z0-9_/-]+$/,
                        ),
                    }),
                  )
                  .max(10),
              })
              .strict(),
          )
          .min(1)
          .max(10),
        resources: z
          .array(
            z.object({
              name,
              engine: z.enum(["postgres", "mysql", "redis", "mongo", "sqlite"]),
            }),
          )
          .max(5),
      })
      .strict(),
  })
  .strict();
export const deploymentJobSchema = z
  .object({
    requestId: uuid,
    versionId: uuid,
    environment: z.enum(["preview", "production"]),
    variables: z
      .record(
        z.string().regex(/^[A-Z][A-Z0-9_]{0,100}$/),
        z.string().max(10000),
      )
      .refine(
        (v) =>
          Object.keys(v).length <= 100 &&
          !Object.keys(v).some((k) =>
            /^(?:EXPO_TOKEN|LUXIPANEL_|LD_|NODE_OPTIONS|GIT_|SSH_)/.test(k),
          ),
      )
      .default({}),
  })
  .strict();
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .filter((key) => (value as any)[key] !== undefined)
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as any)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
function publicJob(state: any) {
  const {
    id,
    status,
    versionId,
    environment,
    error,
    logs,
    result,
    createdAt,
    updatedAt,
  } = state;
  return {
    id,
    status,
    versionId,
    environment,
    error,
    logs,
    result,
    createdAt,
    updatedAt,
  };
}
async function readJson(executor: Executor, file: string) {
  return JSON.parse(String(await executor.readFile(file, "utf8")));
}
async function optionalJson(executor: Executor, file: string) {
  return (await pathExists(executor, file)) ? readJson(executor, file) : null;
}
async function context(
  provider: HostingProvider,
  accountRef: string,
  projectRef: string,
) {
  uuid.parse(accountRef);
  uuid.parse(projectRef);
  const owned = await providerService.ownedAccount(provider, accountRef);
  if (owned.account.status !== "active")
    throw new ForbiddenError("Cuenta suspendida");
  if (
    !/^hp[a-f0-9]{20}$/.test(owned.account.username) ||
    owned.account.homeRoot !== `/home/${owned.account.username}`
  )
    throw new ForbiddenError("Identidad hosting inválida");
  const id = hash(`${provider.id}:${accountRef}:${projectRef}`),
    root = path.join(panelConfigDir(), "hosting", "deployments", id);
  return { ...owned, id, root };
}
async function locked<T>(key: string, fn: () => Promise<T>) {
  const redis = getRedis(),
    owner = randomUUID(),
    lock = "lxp:deployment:" + hash(key);
  if ((await redis.set(lock, owner, "EX", 120, "NX")) !== "OK")
    throw new ConflictError("Operación concurrente");
  try {
    return await fn();
  } finally {
    await redis.eval(
      "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
      1,
      lock,
      owner,
    );
  }
}
export const deploymentProviderService = {
  async register(provider: HostingProvider, account: string, project: string) {
    const c = await context(provider, account, project);
    await c.executor.mkdir(c.root, { recursive: true });
    const probe = await c.executor.exec(
      "test -x /usr/lib/luxipanel/deployment-helper && command -v podman",
      { timeoutMs: 5000 },
    );
    if (
      probe.exitCode === 0 &&
      (await pathExists(c.executor, path.join(c.root, "retire.json")))
    ) {
      const resume = path.join(c.root, "resume.json");
      await c.executor.writeFile(
        resume,
        JSON.stringify({
          projectId: project,
          username: c.account.username,
          home: c.account.homeRoot,
          root: c.root,
        }),
        { mode: 0o600 },
      );
      const result = await c.executor.exec(
        `/usr/bin/sudo -n /usr/lib/luxipanel/deployment-helper ${quoteArg(resume)} resume`,
        { timeoutMs: 30000 },
      );
      if (result.exitCode !== 0)
        throw new ConflictError("deployment_resume_failed");
      await c.executor.unlink(path.join(c.root, "retire.json"));
      await c.executor.unlink(resume);
    }
    return { id: c.id, runtimeInstalled: probe.exitCode === 0 };
  },
  async snapshot(
    provider: HostingProvider,
    account: string,
    project: string,
    version: string,
    input: z.infer<typeof deploymentSnapshotSchema>,
  ) {
    uuid.parse(version);
    const c = await context(provider, account, project);
    const { digest, ...contents } = input.manifest;
    if (hash(canonicalJson(contents)) !== digest)
      throw new ConflictError("Manifiesto modificado");
    return locked(c.id, async () => {
      const root = path.join(c.root, "versions", version),
        file = path.join(root, "manifest.json"),
        old = await optionalJson(c.executor, file);
      if (
        old &&
        (old.sourceDigest !== input.sourceDigest ||
          old.manifest.digest !== digest)
      )
        throw new ConflictError("Versión inmutable");
      await c.executor.mkdir(root, { recursive: true });
      if (!old)
        await c.executor.writeFile(file, JSON.stringify(input), {
          mode: 0o600,
        });
      return { versionId: version, sourceDigest: input.sourceDigest };
    });
  },
  async source(
    provider: HostingProvider,
    account: string,
    project: string,
    version: string,
    buffer: Buffer,
  ) {
    uuid.parse(version);
    if (!Buffer.isBuffer(buffer) || buffer.length > 32 * 1024 * 1024)
      throw new ConflictError("Archivo inválido o demasiado grande");
    const c = await context(provider, account, project),
      root = path.join(c.root, "versions", version),
      manifest = await readJson(c.executor, path.join(root, "manifest.json"));
    if (hash(buffer) !== manifest.sourceDigest)
      throw new ConflictError("Código no coincide con la versión");
    return locked(c.id, async () => {
      const file = path.join(root, "source.zip");
      if (!(await pathExists(c.executor, file)))
        await c.executor.writeFile(file, buffer, { mode: 0o600 });
      return { versionId: version };
    });
  },
  async enqueue(
    provider: HostingProvider,
    account: string,
    project: string,
    input: z.infer<typeof deploymentJobSchema>,
  ) {
    const c = await context(provider, account, project);
    return locked(c.id, async () => {
      if (await pathExists(c.executor, path.join(c.root, "retire.json")))
        throw new ConflictError("deployment_retired");
      const root = path.join(c.root, "jobs", input.requestId),
        stateFile = path.join(root, "state.json"),
        requestDigest = hash(JSON.stringify(input)),
        old = await optionalJson(c.executor, stateFile);
      if (old) {
        if (old.requestDigest !== requestDigest)
          throw new ConflictError("Identificador de trabajo reutilizado");
        return publicJob(old);
      }
      const versionRoot = path.join(c.root, "versions", input.versionId),
        snapshot = deploymentSnapshotSchema.parse(
          await readJson(c.executor, path.join(versionRoot, "manifest.json")),
        );
      if (!(await pathExists(c.executor, path.join(versionRoot, "source.zip"))))
        throw new ConflictError("Falta el código de la versión");
      const probe = await c.executor.exec(
        "test -x /usr/lib/luxipanel/deployment-helper && command -v podman",
        { timeoutMs: 5000 },
      );
      if (probe.exitCode !== 0)
        throw new ConflictError("deployment_runtime_not_installed");
      await c.executor.mkdir(root, { recursive: true });
      const state = {
        id: input.requestId,
        status: "queued",
        versionId: input.versionId,
        environment: input.environment,
        requestDigest,
        createdAt: new Date().toISOString(),
      };
      await c.executor.writeFile(stateFile, JSON.stringify(state), {
        mode: 0o600,
      });
      const task = {
        ...input,
        projectId: project,
        accountId: account,
        providerId: provider.id,
        username: c.account.username,
        home: c.account.homeRoot,
        root,
        versionRoot,
        snapshot,
        limits: {
          memoryMb: 512,
          cpuPercent: 100,
          maxProcesses: 128,
          diskMb: c.account.diskQuotaMb,
          maxDatabases: c.account.maxDatabases,
        },
      };
      const manifest = path.join(root, "input.json");
      await c.executor.writeFile(manifest, JSON.stringify(task), {
        mode: 0o600,
      });
      const command = `nohup /usr/bin/sudo -n /usr/lib/luxipanel/deployment-helper ${quoteArg(manifest)} </dev/null >${quoteArg(path.join(root, "launch.log"))} 2>&1 &`;
      const result = await c.executor.exec(`sh -lc ${quoteArg(command)}`, {
        timeoutMs: 10000,
      });
      if (result.exitCode !== 0) {
        await c.executor.unlink(manifest).catch(() => {});
        throw new ConflictError("deployment_launch_failed");
      }
      return publicJob(state);
    });
  },
  async job(
    provider: HostingProvider,
    account: string,
    project: string,
    id: string,
  ) {
    uuid.parse(id);
    const c = await context(provider, account, project);
    const state = await optionalJson(
      c.executor,
      path.join(c.root, "jobs", id, "state.json"),
    );
    if (!state) throw new NotFoundError("Trabajo de despliegue");
    if (
      !["finished", "failed"].includes(state.status) &&
      Date.now() - Date.parse(state.createdAt) > 35 * 60_000
    )
      return publicJob({
        ...state,
        status: "failed",
        error: "deployment_job_timeout",
      });
    return publicJob(state);
  },
  async activate(
    provider: HostingProvider,
    account: string,
    project: string,
    id: string,
    operation: "activate" | "cleanup" = "activate",
  ) {
    uuid.parse(id);
    const c = await context(provider, account, project),
      root = path.join(c.root, "jobs", id),
      state = await readJson(c.executor, path.join(root, "state.json"));
    if (state.status !== "finished" || state.environment !== "production")
      throw new ConflictError("Publicación no preparada");
    const result = await c.executor.exec(
      `/usr/bin/sudo -n /usr/lib/luxipanel/deployment-helper ${quoteArg(path.join(root, "state.json"))} ${operation}`,
      { timeoutMs: 120000 },
    );
    if (result.exitCode !== 0)
      throw new ConflictError("deployment_activation_failed");
    return { active: true };
  },
  async retire(provider: HostingProvider, account: string, project: string) {
    const c = await context(provider, account, project),
      marker = path.join(c.root, "retire.json");
    await c.executor.writeFile(
      marker,
      JSON.stringify({
        projectId: project,
        username: c.account.username,
        home: c.account.homeRoot,
        root: c.root,
      }),
      { mode: 0o600 },
    );
    const result = await c.executor.exec(
      `/usr/bin/sudo -n /usr/lib/luxipanel/deployment-helper ${quoteArg(marker)} retire`,
      { timeoutMs: 30000 },
    );
    if (result.exitCode !== 0)
      throw new ConflictError("deployment_retirement_failed");
    return { retired: true };
  },
};
