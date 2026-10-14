vi.mock("../../../shared/auth/authorization-revision.js", () => ({ authorizationChanged: vi.fn() }));
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tests del servicio de hosting — camino `update`.
 *
 * Caracterizan (y documentan) el comportamiento de las mutaciones write-behind
 * en `update`, que es la base de la nota de rendimiento:
 *
 *   - Un `update` de METADATOS puros (plan/email/quotas) NO encola nada
 *     (0 `submitMutation`): es un solo escrito de sidecar.
 *   - Un `update` con `displayName` encola UNA receta (fail-HARD: un fallo
 *     rompe el update).
 *   - Un `update` que ADEMÁS voltea el jail encola una SEGUNDA receta aparte
 *     (fail-SOFT: un fallo del jail se traga y NO rompe el update). Por eso las
 *     dos mutaciones NO pueden fusionarse en una sola receta: tienen semánticas
 *     de error deliberadamente distintas (invariante documentado en el módulo).
 *   - `allowedModules` se saneа contra la SSOT `validModuleSlugs()` (delegada a
 *     users/auth `assignableModuleSlugs`), no contra un literal local.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const envMock = { JAIL_SHELL_ENABLED: true, LOG_LEVEL: "silent" };
  return {
    envMock,
    findById: vi.fn(),
    repoUpdate: vi.fn(),
    auditAppend: vi.fn(async () => undefined),
    submitMutation: vi.fn(async () => ({ jobId: "j1", mode: "applied" as const })),
    buildSetDisplayNameSteps: vi.fn(() => [{ type: "sh", argv: ["usermod", "-c", "New", "acme"], sudo: true }]),
    buildJailSetupSteps: vi.fn(() => [{ type: "sh", argv: ["jk_init"], sudo: true }]),
    rolesUpdateByName: vi.fn(async () => undefined),
    buildEffectivePermissions: vi.fn(() => ({})),
    validModuleSlugs: vi.fn(() => ["files", "mail", "dns", "backups", "cron"]),
    detectQuotaSupport: vi.fn(async () => ({ softOnly: true })),
  };
});

vi.mock("../../../config/env.js", () => ({ get env() { return h.envMock; } }));
vi.mock("../repositories/hosting-account.repository.js", () => ({
  hostingAccountRepository: {
    findById: (...a: unknown[]) => h.findById(...(a as [])),
    update: (...a: unknown[]) => h.repoUpdate(...(a as [])),
  },
}));
vi.mock("../repositories/audit.repository.js", () => ({
  hostingAuditRepository: { append: (...a: unknown[]) => h.auditAppend(...(a as [])) },
}));
vi.mock("../../auth/services/role-permissions.service.js", () => ({
  buildEffectivePermissions: (...a: unknown[]) => h.buildEffectivePermissions(...(a as [])),
}));
vi.mock("../../users/services/system-accounts.service.js", () => ({
  systemAccountsService: {
    buildSetDisplayNameSteps: (...a: unknown[]) => h.buildSetDisplayNameSteps(...(a as [])),
    buildJailSetupSteps: (...a: unknown[]) => h.buildJailSetupSteps(...(a as [])),
  },
}));
vi.mock("../../users/services/roles.service.js", () => ({
  rolesService: { updateByName: (...a: unknown[]) => h.rolesUpdateByName(...(a as [])) },
  validModuleSlugs: (...a: unknown[]) => h.validModuleSlugs(...(a as [])),
}));
vi.mock("../../../shared/remote-cache/submit-mutation.js", () => ({
  submitMutation: (...a: unknown[]) => h.submitMutation(...(a as [])),
}));
vi.mock("../../../shared/quota/quota-support.js", () => ({
  detectQuotaSupport: (...a: unknown[]) => h.detectQuotaSupport(...(a as [])),
}));
vi.mock("../../../shared/executor/index.js", async () => {
  const quote = await vi.importActual<typeof import("../../../shared/executor/quote.js")>(
    "../../../shared/executor/quote.js",
  );
  return { quoteArg: quote.quoteArg, quoteCmd: quote.quoteCmd };
});

import { hostingService } from "./hosting.service.js";
import type { HostingAccount } from "../models/hosting-account.model.js";

function makeAccount(over: Partial<HostingAccount> = {}): HostingAccount {
  return {
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
    jailEnabled: false,
    jailedAt: undefined,
    notes: null,
    suspendedAt: null,
    expiresAt: null,
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
    ...over,
  } as unknown as HostingAccount;
}

const executor = { target: { id: "srv1", name: "srv1" } } as never;

beforeEach(() => {
  vi.clearAllMocks();
  h.envMock.JAIL_SHELL_ENABLED = true;
  h.submitMutation.mockResolvedValue({ jobId: "j1", mode: "applied" as const });
  // repo.update echoes the patch back so update() returns a truthy account.
  h.repoUpdate.mockImplementation(async (_id: number, patch: Record<string, unknown>) => ({
    ...makeAccount(),
    ...patch,
  }));
});

describe("hostingService.update — write-behind shape", () => {
  it("pure-metadata update enqueues NOTHING (0 submitMutation)", async () => {
    h.findById.mockResolvedValue(makeAccount());
    await hostingService.update(7, { plan: "pro", email: "a@b.com", maxDomains: 25 }, executor);
    expect(h.submitMutation).not.toHaveBeenCalled();
    expect(h.repoUpdate).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ plan: "pro", email: "a@b.com", maxDomains: 25 }),
      executor,
    );
  });

  it("displayName-only update enqueues exactly ONE recipe (fail-hard)", async () => {
    h.findById.mockResolvedValue(makeAccount());
    await hostingService.update(7, { displayName: "New" }, executor);
    expect(h.buildSetDisplayNameSteps).toHaveBeenCalledWith("acme", "New");
    expect(h.submitMutation).toHaveBeenCalledTimes(1);
  });

  it("jail-flip + displayName enqueues TWO separate recipes (fail-soft jail, fail-hard rename)", async () => {
    // account.jailEnabled=false → flipping to true triggers the jail recipe,
    // and the displayName change triggers a second one. They are deliberately
    // NOT fused: the jail step is fail-soft, the rename is fail-hard.
    h.findById.mockResolvedValue(makeAccount({ jailEnabled: false }));
    await hostingService.update(7, { jailEnabled: true, displayName: "New" }, executor);
    expect(h.buildJailSetupSteps).toHaveBeenCalledTimes(1);
    expect(h.buildSetDisplayNameSteps).toHaveBeenCalledTimes(1);
    expect(h.submitMutation).toHaveBeenCalledTimes(2);
  });

  it("a jail-toggle failure is fail-soft: the update still completes", async () => {
    h.findById.mockResolvedValue(makeAccount({ jailEnabled: false }));
    // First submitMutation (jail) throws; the rename one still applies.
    h.submitMutation
      .mockRejectedValueOnce(new Error("jailkit exploded"))
      .mockResolvedValue({ jobId: "j2", mode: "applied" as const });
    const updated = await hostingService.update(7, { jailEnabled: true, displayName: "New" }, executor);
    expect(updated).toBeTruthy();
    expect(h.repoUpdate).toHaveBeenCalled();
  });

  it("allowedModules is sanitized against the SSOT validModuleSlugs (not a local literal)", async () => {
    h.findById.mockResolvedValue(makeAccount());
    await hostingService.update(7, { allowedModules: ["files", "evil-module", "mail"] }, executor);
    // The bogus slug is dropped by the shared catalog.
    expect(h.validModuleSlugs).toHaveBeenCalled();
    const patch = h.repoUpdate.mock.calls[0]![1] as { allowedModules: string[] };
    expect(patch.allowedModules).toEqual(["files", "mail"]);
    // The envelope role is re-applied under the tenant group.
    expect(h.rolesUpdateByName).toHaveBeenCalledWith("h-acme", expect.any(Object));
  });
});
