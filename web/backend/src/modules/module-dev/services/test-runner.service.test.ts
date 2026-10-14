import { describe, expect, it, beforeEach, vi } from "vitest";

// vi.mock SIEMPRE antes de importar el módulo bajo prueba.
const { getContextExecutorMock, getByProjectIdMock } = vi.hoisted(() => ({
  getContextExecutorMock: vi.fn(),
  getByProjectIdMock: vi.fn(),
}));

vi.mock("../../../config/env.js", () => ({
  env: {
    NODE_ENV: "test",
    LOG_LEVEL: "error", // el logger compartido lee env.LOG_LEVEL al importar
    MODULE_DEV_TEST_TIMEOUT_MS: 180_000,
    MODULE_DEV_TEST_MAX_OUTPUT_KB: 1, // 1 KB para probar el cap de salida
    MODULE_DEV_PREVIEW_MAX_FILES: 200,
    MODULE_DEV_PREVIEW_MAX_TOTAL_MB: 10,
  },
}));

vi.mock("../../../shared/executor/context.js", () => ({
  getContextExecutor: getContextExecutorMock,
}));

vi.mock("../../../shared/marketplace-link/index.js", () => ({
  marketplaceLinkRepository: { getByProjectId: getByProjectIdMock },
  MODULE_ID_RE: /^[a-z][a-z0-9-]{2,38}$/,
}));

vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: vi.fn(() => ({ get: vi.fn(async () => null) })),
}));

const {
  testRunnerService,
  buildTestCommand,
  capOutput,
  effectiveTimeoutMs,
} = await import("./test-runner.service.js");
const { EXEC_TIMEOUT_CAP_MS } = await import("../../../shared/constants.js");
const { AppError, NotFoundError } = await import("../../../shared/errors/index.js");

const LINK = {
  id: "l1",
  projectId: "p1",
  moduleId: "acme-cache",
  projectPath: "/home/dev/proyecto",
  provider: "claude" as const,
};

interface ExecCall {
  cmd: string;
}

function makeExecutor(opts: {
  manifestInModulesDir?: boolean;
  packageJson?: string | null;
  execResult?: { stdout: string; stderr: string; exitCode: number; durationMs: number };
  execError?: Error;
}) {
  const calls: ExecCall[] = [];
  const executor = {
    target: { id: "t1", name: "srv" },
    stat: vi.fn(async (p: string) => {
      if (
        opts.manifestInModulesDir &&
        p === "/home/dev/proyecto/modules/acme-cache/module.manifest.json"
      ) {
        return {} as never;
      }
      throw new Error("ENOENT");
    }),
    readFile: vi.fn(async (p: string) => {
      if (p.endsWith("package.json")) {
        if (opts.packageJson === null || opts.packageJson === undefined) throw new Error("ENOENT");
        return opts.packageJson;
      }
      throw new Error("ENOENT");
    }),
    exec: vi.fn(async (cmd: string) => {
      calls.push({ cmd });
      if (opts.execError) throw opts.execError;
      return opts.execResult ?? { stdout: "", stderr: "", exitCode: 0, durationMs: 5 };
    }),
  };
  return { executor, calls };
}

beforeEach(() => {
  getContextExecutorMock.mockReset();
  getByProjectIdMock.mockReset();
  getByProjectIdMock.mockResolvedValue(LINK);
});

describe("piezas puras", () => {
  it("buildTestCommand: scripts.test → npm, si no → node --test", () => {
    expect(buildTestCommand(true)).toBe("npm test --silent");
    expect(buildTestCommand(false)).toBe("node --test");
  });

  it("capOutput recorta y marca el truncado", () => {
    const big = "x".repeat(5000);
    const capped = capOutput(big, 1024);
    expect(capped.length).toBeLessThan(big.length);
    expect(capped).toContain("truncada");
    expect(capOutput("corto", 1024)).toBe("corto");
  });

  it("effectiveTimeoutMs aplica min(pedido ?? env, 600s)", () => {
    expect(effectiveTimeoutMs(undefined)).toBe(180_000);
    expect(effectiveTimeoutMs(5_000)).toBe(5_000);
    expect(effectiveTimeoutMs(999_999_999)).toBe(EXEC_TIMEOUT_CAP_MS);
  });
});

describe("testRunnerService.runTests", () => {
  it("falla cerrado sin executor de contexto", async () => {
    getContextExecutorMock.mockReturnValue(null);
    await expect(testRunnerService.runTests("p1")).rejects.toBeInstanceOf(AppError);
  });

  it("lanza NotFound tipado sin marketplace-link", async () => {
    const { executor } = makeExecutor({});
    getContextExecutorMock.mockReturnValue(executor);
    getByProjectIdMock.mockResolvedValue(null);
    await expect(testRunnerService.runTests("p1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("usa npm test --silent cuando hay scripts.test y corre en modules/<id>", async () => {
    const { executor, calls } = makeExecutor({
      manifestInModulesDir: true,
      packageJson: JSON.stringify({ scripts: { test: "vitest run" } }),
      execResult: { stdout: "ok\n", stderr: "", exitCode: 0, durationMs: 11 },
    });
    getContextExecutorMock.mockReturnValue(executor);
    const result = await testRunnerService.runTests("p1");
    expect(result.command).toBe("npm test --silent");
    expect(result.passed).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    // El comando real va por sh -lc (args citados por quoteCmd) con cd al
    // dir del módulo + CI=1 + timeout(1).
    expect(calls[0]!.cmd).toContain("sh '-lc'");
    expect(calls[0]!.cmd).toContain("/home/dev/proyecto/modules/acme-cache");
    expect(calls[0]!.cmd).toContain("CI=1 timeout -k 5");
    expect(calls[0]!.cmd).toContain("npm test --silent");
  });

  it("cae a node --test sin package.json y usa projectPath sin modules/<id>", async () => {
    const { executor, calls } = makeExecutor({
      manifestInModulesDir: false,
      packageJson: null,
      execResult: { stdout: "", stderr: "1 failing", exitCode: 1, durationMs: 9 },
    });
    getContextExecutorMock.mockReturnValue(executor);
    const result = await testRunnerService.runTests("p1");
    expect(result.command).toBe("node --test");
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(calls[0]!.cmd).toContain("'/home/dev/proyecto'");
  });

  it("capa stdout/stderr al límite de MODULE_DEV_TEST_MAX_OUTPUT_KB", async () => {
    const { executor } = makeExecutor({
      packageJson: null,
      execResult: { stdout: "a".repeat(10_000), stderr: "b".repeat(10_000), exitCode: 0, durationMs: 3 },
    });
    getContextExecutorMock.mockReturnValue(executor);
    const result = await testRunnerService.runTests("p1");
    // 1 KB de cap + marcador
    expect(result.stdout.length).toBeLessThan(1_300);
    expect(result.stdout).toContain("truncada");
    expect(result.stderr).toContain("truncada");
  });

  it("exit 124 del timeout(1) remoto marca timedOut", async () => {
    const { executor } = makeExecutor({
      packageJson: null,
      execResult: { stdout: "", stderr: "", exitCode: 124, durationMs: 180_500 },
    });
    getContextExecutorMock.mockReturnValue(executor);
    const result = await testRunnerService.runTests("p1");
    expect(result.timedOut).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("un fallo de transporte no lanza: devuelve resultado con stderr", async () => {
    const { executor } = makeExecutor({
      packageJson: null,
      execError: new Error("ssh channel closed"),
    });
    getContextExecutorMock.mockReturnValue(executor);
    const result = await testRunnerService.runTests("p1");
    expect(result.exitCode).toBeNull();
    expect(result.passed).toBe(false);
    expect(result.stderr).toContain("ssh channel closed");
  });
});

describe("testRunnerService.runChecks", () => {
  it("manifest ausente → manifestFound:false con nota accionable", async () => {
    const { executor } = makeExecutor({});
    getContextExecutorMock.mockReturnValue(executor);
    const result = await testRunnerService.runChecks("p1");
    expect(result.manifestFound).toBe(false);
    expect(result.validation.valid).toBe(false);
    expect(result.entryExists).toBe(false);
    expect(result.notes.join(" ")).toContain("module.manifest.json");
  });

  it("manifest válido + entry presente → checks verdes; id distinto al link → error", async () => {
    const manifest = {
      id: "otro-id",
      name: "Acme",
      description: "x",
      sdk: "^1.0.0",
      category: "developer",
      icon: "tabler:flame",
      color: "teal",
      scope: "local",
      min_specs: { cpu: 1, ramMb: 128, diskMb: 10 },
      capabilities: [],
      pricing: { model: "free", tokensPerMonth: 0 },
      entry: { backend: "backend/index.js" },
    };
    const executor = {
      target: { id: "t1", name: "srv" },
      stat: vi.fn(async (p: string) => {
        // manifest en projectPath directo + entry presente
        if (p === "/home/dev/proyecto/modules/acme-cache/module.manifest.json") throw new Error("ENOENT");
        return {} as never;
      }),
      readFile: vi.fn(async (p: string) => {
        if (p.endsWith("module.manifest.json")) return JSON.stringify(manifest);
        throw new Error("ENOENT");
      }),
      exec: vi.fn(),
    };
    getContextExecutorMock.mockReturnValue(executor);
    const result = await testRunnerService.runChecks("p1");
    expect(result.manifestFound).toBe(true);
    expect(result.entryExists).toBe(true);
    // El id no coincide con link.moduleId → invalida y deja nota.
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.some((e) => e.path === "id")).toBe(true);
    expect(result.notes.join(" ")).toContain("acme-cache");
  });
});
