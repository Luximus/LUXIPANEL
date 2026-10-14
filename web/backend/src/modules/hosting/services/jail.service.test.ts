// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tests del servicio de jail (Fase 5). Cubren la lógica no trivial:
 *  - isJailkitAvailable: detección por `command -v jk_init` + respaldo binario.
 *  - provisionJail: degradación accionable (flag off / jailkit ausente) sin
 *    encolar nada; y el camino feliz que encola la receta de buildJailSetupSteps.
 *  - teardownJail: revierte shell + umount idempotente.
 *  - jailStatus: refleja envelope + disponibilidad.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted: los mocks de vi.mock se elevan, así que el estado compartido debe
// vivir en vi.hoisted para estar inicializado cuando los factories corren.
const h = vi.hoisted(() => {
  const envMock = { JAIL_SHELL_ENABLED: true, JAIL_TOOL_PATH: "/usr/sbin/jk_chrootsh", LOG_LEVEL: "silent" };
  const submitMutation = vi.fn(async () => ({ jobId: "j1", mode: "applied" as const }));
  const buildJailSetupSteps = vi.fn(() => [{ type: "sh", argv: ["jk_init"], sudo: true }]);
  const emit = vi.fn(() => true);
  return { envMock, submitMutation, buildJailSetupSteps, emit };
});
const { envMock, submitMutation, buildJailSetupSteps, emit } = h;

vi.mock("../../../config/env.js", () => ({ get env() { return h.envMock; } }));
vi.mock("../../../shared/remote-cache/submit-mutation.js", () => ({
  submitMutation: (...a: unknown[]) => h.submitMutation(...(a as [])),
}));
vi.mock("../../users/services/system-accounts.service.js", () => ({
  systemAccountsService: { buildJailSetupSteps: (...a: unknown[]) => h.buildJailSetupSteps(...(a as [])) },
  DEFAULT_LOGIN_SHELL: "/bin/bash",
}));
// El servicio NO importa notifications.service: emite por el event bus
// (patrón canónico, sin cross-import de módulos). Mockeamos sólo `emit`.
vi.mock("../../../shared/events/index.js", () => ({
  eventBus: { emit: (...a: unknown[]) => h.emit(...(a as [])) },
  Events: { HOSTING_JAIL_DEGRADED: "hosting:jail:degraded" },
}));
// jail.service sólo usa `quoteArg` (+ el tipo Executor) del barrel de executor.
// Mockear el barrel evita cargar ssh-proxy-client.service → secret-store, que
// revienta en import-time porque el env mockeado no define LUXIPANEL_CONFIG_DIR.
vi.mock("../../../shared/executor/index.js", async () => {
  const quote = await vi.importActual<typeof import("../../../shared/executor/quote.js")>(
    "../../../shared/executor/quote.js",
  );
  return { quoteArg: quote.quoteArg, quoteCmd: quote.quoteCmd };
});

import { hostingJailService } from "./jail.service.js";
import type { HostingAccount } from "../models/hosting-account.model.js";

// --- Fake Executor que graba los comandos `exec` --------------------------
interface FakeExecutor {
  target: { id: string; name: string };
  execResponses: Array<{ stdout: string; exitCode: number }>;
  execCalls: string[];
  exec(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}
function makeExecutor(responses: Array<{ stdout: string; exitCode: number }>): FakeExecutor {
  const queue = [...responses];
  return {
    target: { id: "srv1", name: "srv1" },
    execResponses: responses,
    execCalls: [],
    async exec(cmd: string) {
      this.execCalls.push(cmd);
      const r = queue.shift() ?? { stdout: "", exitCode: 0 };
      return { stdout: r.stdout, stderr: "", exitCode: r.exitCode };
    },
  };
}

const account: HostingAccount = {
  id: 7,
  username: "acme",
  displayName: "ACME",
  email: null,
  passwordHash: "x",
  plan: "basic",
  status: "active",
  tenantGroup: "h-acme",
  homeRoot: "/home/acme",
  allowedModules: ["files", "mail"],
  permissionTemplate: {} as never,
  diskQuotaMb: 10240,
  bandwidthQuotaMb: 102400,
  maxDomains: 10,
  maxEmailAccounts: 20,
  maxDatabases: 5,
  maxSubUsers: 10,
  jailEnabled: true,
  jailedAt: undefined,
  notes: null,
  suspendedAt: null,
  expiresAt: null,
  createdAt: "2026-06-14T00:00:00.000Z",
  updatedAt: "2026-06-14T00:00:00.000Z",
} as unknown as HostingAccount;

beforeEach(() => {
  vi.clearAllMocks();
  envMock.JAIL_SHELL_ENABLED = true;
  envMock.JAIL_TOOL_PATH = "/usr/sbin/jk_chrootsh";
});

describe("hostingJailService.isJailkitAvailable", () => {
  it("true cuando `command -v jk_init` devuelve una ruta", async () => {
    const ex = makeExecutor([{ stdout: "/usr/sbin/jk_init", exitCode: 0 }]);
    await expect(hostingJailService.isJailkitAvailable(ex as never)).resolves.toBe(true);
  });

  it("usa el respaldo `[ -x ... ]` cuando command -v está vacío", async () => {
    const ex = makeExecutor([
      { stdout: "", exitCode: 0 }, // command -v vacío
      { stdout: "yes", exitCode: 0 }, // respaldo encuentra el binario
    ]);
    await expect(hostingJailService.isJailkitAvailable(ex as never)).resolves.toBe(true);
    expect(ex.execCalls[1]).toContain("/usr/sbin/jk_init");
  });

  it("false cuando ni command -v ni el respaldo resuelven", async () => {
    const ex = makeExecutor([
      { stdout: "", exitCode: 0 },
      { stdout: "", exitCode: 0 },
    ]);
    await expect(hostingJailService.isJailkitAvailable(ex as never)).resolves.toBe(false);
  });
});

describe("hostingJailService.provisionJail", () => {
  it("degrada (sin encolar) cuando JAIL_SHELL_ENABLED=false", async () => {
    envMock.JAIL_SHELL_ENABLED = false;
    const ex = makeExecutor([]);
    const res = await hostingJailService.provisionJail(account, ex as never);
    expect(res).toEqual({ jailed: false, degraded: true, reason: "JAIL_SHELL_ENABLED=false" });
    expect(submitMutation).not.toHaveBeenCalled();
    expect(buildJailSetupSteps).not.toHaveBeenCalled();
  });

  it("degrada + emite evento cuando jailkit no está instalado", async () => {
    const ex = makeExecutor([
      { stdout: "", exitCode: 0 }, // command -v vacío
      { stdout: "", exitCode: 0 }, // respaldo vacío
    ]);
    const res = await hostingJailService.provisionJail(account, ex as never);
    expect(res.jailed).toBe(false);
    expect(res.degraded).toBe(true);
    expect(res.reason).toMatch(/jailkit/i);
    expect(submitMutation).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]![0]).toBe("hosting:jail:degraded");
    const payload = emit.mock.calls[0]![1] as { username: string; accountId: number };
    expect(payload.username).toBe("acme");
    expect(payload.accountId).toBe(7);
  });

  it("encola la receta de buildJailSetupSteps cuando jailkit está disponible", async () => {
    const ex = makeExecutor([{ stdout: "/usr/sbin/jk_init", exitCode: 0 }]);
    const res = await hostingJailService.provisionJail(account, ex as never);
    expect(res.jailed).toBe(true);
    expect(res.degraded).toBe(false);
    expect(typeof res.jailedAt).toBe("string");
    expect(buildJailSetupSteps).toHaveBeenCalledWith(
      "/home/acme", "acme", "h-acme", ["files", "mail"],
    );
    expect(submitMutation).toHaveBeenCalledTimes(1);
    const input = submitMutation.mock.calls[0]![1] as { op: string; module: string; collection: string };
    expect(input.op).toBe("update");
    expect(input.module).toBe("hosting");
    expect(input.collection).toBe("accounts");
  });

  it("lanza si la cola no confirma (mode != applied)", async () => {
    submitMutation.mockResolvedValueOnce({ jobId: "j2", mode: "queued" as never });
    const ex = makeExecutor([{ stdout: "/usr/sbin/jk_init", exitCode: 0 }]);
    await expect(hostingJailService.provisionJail(account, ex as never)).rejects.toThrow(/no se confirmó/i);
  });
});

describe("hostingJailService.teardownJail", () => {
  it("encola usermod -s /bin/bash + umount idempotente del /proc del jail", async () => {
    const ex = makeExecutor([]);
    await hostingJailService.teardownJail(account, ex as never);
    expect(submitMutation).toHaveBeenCalledTimes(1);
    const input = submitMutation.mock.calls[0]![1] as { steps: Array<{ argv: string[] }> };
    expect(input.steps[0]!.argv).toEqual(["usermod", "-s", "/bin/bash", "acme"]);
    expect(input.steps[1]!.argv.join(" ")).toContain("/home/acme/proc");
    expect(input.steps[1]!.argv.join(" ")).toContain("umount");
  });
});

describe("hostingJailService.jailStatus", () => {
  it("refleja el envelope + disponibilidad de jailkit", async () => {
    const ex = makeExecutor([{ stdout: "/usr/sbin/jk_init", exitCode: 0 }]);
    const st = await hostingJailService.jailStatus(account, ex as never);
    expect(st).toEqual({ jailEnabled: true, jailedAt: null, jailkitAvailable: true });
  });
});
