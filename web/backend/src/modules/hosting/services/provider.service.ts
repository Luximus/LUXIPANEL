import { hostingTemplateService } from "./hosting-template.service.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Machine-to-machine hosting contract. The provider never chooses an executor. */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { providerRepository } from "../repositories/provider.repository.js";
import type { HostingProvider, ProviderOperation, ProviderAccountLink } from "../models/provider.model.js";
import { PROVIDER_OPERATIONS } from "../models/provider.model.js";
import { targetsRepository } from "../../servers/repositories/targets.repository.js";
import { getVaultExecutor } from "../../../shared/executor/vault-executor.js";
import { localExecutor, LOCAL_TARGET_ID, runWithExecutor, type Executor } from "../../../shared/executor/index.js";
import { hostingService } from "./hosting.service.js";
import { hostingAccountRepository } from "../repositories/hosting-account.repository.js";
import { nginxSitesService } from "../../nginx/services/nginx-sites.service.js";
import { siteFormSchema } from "../../nginx/models/nginx.model.js";
import { getRedis } from "../../../shared/redis/index.js";
import { authSessionService } from "../../auth/services/auth/auth-session.service.js";
import { ssoHandoffService } from "../../auth/services/sso-handoff.service.js";
import { sshCredentialsCache } from "../../auth/services/ssh-credentials-cache.service.js";
import { securitySettingsService } from "../../admin/services/security-settings.service.js";
import { panelUserRepository, totpRepository } from "../../auth/repositories/index.js";
import { systemAccountsService } from "../../users/services/system-accounts.service.js";
import { readTenantUsage } from "../../../shared/quota/quota-checker.js";
import { AuthError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { defaultProviderGroupTemplate, normalizeProviderGroupTemplate, instantiateProviderGroupTemplate } from "./provider-group-policy.js";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const ACCOUNT_MARK = "LUXIPANEL_PROVIDER:";
const SITE_MARK = "# LUXIPANEL_PROVIDER ";

function publicProvider(provider: HostingProvider) {
  const { keyHash: _hash, ...safe } = provider;
  return { ...safe, groupTemplate: safe.groupTemplate ?? defaultProviderGroupTemplate(safe.allowedModules) };
}

function assertReference(value: string): string {
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(value)) throw new ValidationError("Referencia externa inválida");
  return value;
}

function accountUsername(providerId: string, externalId: string): string {
  return `hp${sha256(`${providerId}:${externalId}`).slice(0, 20)}`;
}

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  const token = randomUUID();
  const lockKey = `lxp:hosting-provider-lock:${sha256(key)}`;
  const locked = await redis.set(lockKey, token, "EX", 600, "NX");
  if (locked !== "OK") throw new ConflictError("Operación en curso; reintenta");
  try { return await fn(); }
  finally {
    await redis.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end", 1, lockKey, token);
  }
}

async function executorFor(provider: HostingProvider): Promise<Executor> {
  if (provider.targetId === LOCAL_TARGET_ID) return localExecutor;
  const target = await targetsRepository.getView(provider.targetId);
  if (!target?.enabled || !target.hostFingerprint) throw new ForbiddenError("Servidor de proveedor no disponible o sin huella aprobada");
  const executor = await getVaultExecutor(provider.targetId);
  if (!executor) throw new NotFoundError("Servidor de proveedor");
  return executor;
}

async function ownedAccount(provider: HostingProvider, externalId: string) {
  const link = await providerRepository.findAccount(provider.id, assertReference(externalId));
  if (!link || link.targetId !== provider.targetId) throw new NotFoundError("Cuenta de proveedor");
  const executor = await executorFor(provider);
  const account = await hostingService.findById(link.accountId, executor);
  if (account.notes !== `${ACCOUNT_MARK}${provider.id}:${externalId}`) throw new ConflictError("La cuenta perdió su vinculación con el proveedor");
  return { link, account, executor };
}

export const providerService = {
  publicProvider,
  ownedAccount,

  async listTemplates(providerId: string) {
    const provider = await providerRepository.get(providerId);
    if (!provider) throw new NotFoundError("Provider");
    return hostingTemplateService.list(await executorFor(provider));
  },
  async listTemplatesForTarget(targetId: string) {
    return hostingTemplateService.list(await executorFor({ targetId } as HostingProvider));
  },
  async listProviders() { return (await providerRepository.list()).map(publicProvider); },

  async createProvider(input: Omit<HostingProvider, "id" | "keyHash" | "keyPrefix" | "createdAt" | "updatedAt">) {
    if (input.allowedModules.includes("admin")) throw new ValidationError("Módulo no disponible para grupos de hosting");
    if (input.groupTemplate) input = { ...input, groupTemplate: normalizeProviderGroupTemplate(input.groupTemplate, input.allowedModules) };
    if (input.targetId !== LOCAL_TARGET_ID) {
      const target = await targetsRepository.getView(input.targetId);
      if (!target?.enabled || !target.hostFingerprint) throw new ValidationError("Selecciona un servidor SSH activo con huella aprobada");
    }
    if (input.templateId) await hostingTemplateService.get(await executorFor(input as HostingProvider), input.templateId);
    const raw = `lhp_${randomBytes(32).toString("base64url")}`;
    const record = await providerRepository.create({ ...input, id: randomUUID(), keyHash: sha256(raw), keyPrefix: raw.slice(0, 12) } as HostingProvider);
    return { provider: publicProvider(record), key: raw };
  },

  async updateProvider(id: string, patch: Partial<HostingProvider>) {
    const existing = await providerRepository.get(id);
    if (!existing) throw new NotFoundError("Proveedor");
    // A target change after provisioning would silently cross tenant boundaries.
    if (patch.targetId && patch.targetId !== existing.targetId) throw new ConflictError("El servidor asignado es inmutable; crea otro proveedor");
    const modules = patch.allowedModules ?? existing.allowedModules;
    if (modules.includes("admin")) throw new ValidationError("Módulo no disponible para grupos de hosting");
    const template = patch.groupTemplate !== undefined ? patch.groupTemplate : existing.groupTemplate;
    if (template) patch = { ...patch, groupTemplate: normalizeProviderGroupTemplate(template, modules) };
    if (patch.templateId) await hostingTemplateService.get(await executorFor(existing), patch.templateId);
    const updated = await providerRepository.update(id, patch);
    if (!updated) throw new NotFoundError("Proveedor");
    return publicProvider(updated);
  },

  async rotateKey(id: string) {
    const existing = await providerRepository.get(id);
    if (!existing) throw new NotFoundError("Proveedor");
    const raw = `lhp_${randomBytes(32).toString("base64url")}`;
    const updated = await providerRepository.update(id, { keyHash: sha256(raw), keyPrefix: raw.slice(0, 12) });
    if (!updated) throw new NotFoundError("Proveedor");
    return { provider: publicProvider(updated), key: raw };
  },

  async authenticate(raw: string): Promise<HostingProvider> {
    if (!raw.startsWith("lhp_") || raw.length > 128) throw new AuthError("Credencial de proveedor inválida");
    const digest = Buffer.from(sha256(raw), "hex");
    const providers = await providerRepository.list();
    const found = providers.find((p) => p.enabled && /^[a-f0-9]{64}$/.test(p.keyHash) && timingSafeEqual(Buffer.from(p.keyHash, "hex"), digest));
    if (!found) throw new AuthError("Credencial de proveedor inválida");
    return found;
  },

  assertOperation(provider: HostingProvider, operation: ProviderOperation) {
    if (!PROVIDER_OPERATIONS.includes(operation) || !provider.operations.includes(operation)) throw new ForbiddenError("Operación no concedida al proveedor");
  },

  async getAccount(provider: HostingProvider, externalId: string) {
    const { account } = await ownedAccount(provider, externalId);
    const { passwordHash: _password, ...safe } = account;
    return safe;
  },

  async ensureAccount(provider: HostingProvider, externalId: string, input: { displayName?: string; email?: string }) {
    assertReference(externalId);
    return withLock(`${provider.id}:account:${externalId}`, async () => {
      const executor = await executorFor(provider);
      let link = await providerRepository.findAccount(provider.id, externalId);
      if (!link) {
        const username = accountUsername(provider.id, externalId);
        const existing = await hostingAccountRepository.findByUsername(username, executor);
        if (existing && existing.notes !== `${ACCOUNT_MARK}${provider.id}:${externalId}`) throw new ConflictError("Nombre de cuenta reservado");
        const account = existing ?? await runWithExecutor(executor, () => hostingService.create({
          username,
          password: randomBytes(48).toString("base64url"),
          displayName: input.displayName,
          email: input.email,
          plan: provider.plan,
          templateId: provider.templateId ?? undefined,
          allowedModules: provider.allowedModules,
          permissionTemplate: provider.groupTemplate
            ? instantiateProviderGroupTemplate(provider.groupTemplate, provider.allowedModules, `/home/${username}`)
            : undefined,
          diskQuotaMb: provider.diskQuotaMb,
          bandwidthQuotaMb: provider.bandwidthQuotaMb,
          maxDomains: provider.maxDomains,
          maxEmailAccounts: provider.maxEmailAccounts,
          maxDatabases: provider.maxDatabases,
          maxSubUsers: provider.maxSubUsers,
          jailEnabled: provider.jailEnabled,
          notes: `${ACCOUNT_MARK}${provider.id}:${externalId}`,
        }, executor));
        link = await providerRepository.createAccount({
          id: randomUUID(), providerId: provider.id, externalAccountId: externalId,
          accountId: account.id, targetId: provider.targetId,
        } as ProviderAccountLink);
      }
      // Provision the ordinary panel identity as part of account setup, rather
      // than inventing an unrelated user id when issuing an access ticket.
      const account = await this.getAccount(provider, externalId);
      await runWithExecutor(executor, async () => {
        const user = await panelUserRepository.findByUsername(account.username);
        if (!user && !await systemAccountsService.syncUserToDatabase(account.username)) {
          throw new ConflictError("Usuario del panel aún no aprovisionado; reintenta");
        }
      });
      return account;
    });
  },

  async updateAccount(provider: HostingProvider, externalId: string, input: { displayName?: string; email?: string; status?: "active" | "suspended" }) {
    return withLock(`${provider.id}:account:${externalId}`, async () => {
      const { account, executor } = await ownedAccount(provider, externalId);
      if (input.status === "suspended") await runWithExecutor(executor, () => hostingService.suspend(account.id, executor));
      else if (input.status === "active") await runWithExecutor(executor, () => hostingService.unsuspend(account.id, executor));
      if (input.displayName !== undefined || input.email !== undefined) {
        await runWithExecutor(executor, () => hostingService.update(account.id, { displayName: input.displayName, email: input.email }, executor));
      }
      return this.getAccount(provider, externalId);
    });
  },

  async terminateAccount(provider: HostingProvider, externalId: string) {
    return withLock(`${provider.id}:account:${externalId}`, async () => {
      const { link, account, executor } = await ownedAccount(provider, externalId);
      if ((await providerRepository.listSitesForAccount(provider.id, externalId)).length) throw new ConflictError("Desvincula primero los sitios de la cuenta");
      await runWithExecutor(executor, () => hostingService.terminate(account.id, executor));
      await providerRepository.deleteAccount(link.id);
    });
  },

  async usage(provider: HostingProvider, externalId: string) {
    const { account, executor } = await ownedAccount(provider, externalId);
    const measured = await readTenantUsage(executor, account);
    return { accountId: account.id, status: account.status, diskQuotaMb: account.diskQuotaMb,
      diskUsedMb: measured.diskUsedMb, bandwidthQuotaMb: account.bandwidthQuotaMb,
      maxDomains: account.maxDomains, domainsUsed: measured.domainsUsed,
      emailAccountsUsed: measured.emailAccountsUsed, databasesUsed: measured.databasesUsed,
      subUsersUsed: measured.subUsersUsed, warnings: measured.warnings };
  },

  async bindSite(provider: HostingProvider, externalId: string, siteId: string, domain: string) {
    assertReference(siteId);
    const parsed = siteFormSchema.parse({ kind: "proxy", domain, proxyPass: provider.upstreamUrl, websocket: true });
    return withLock(`${provider.targetId}:domain:${parsed.domain}`, async () => {
      const { account, executor } = await ownedAccount(provider, externalId);
      if (account.status !== "active") throw new ForbiddenError("Cuenta suspendida");
      const existing = await providerRepository.findSite(provider.id, siteId);
      if (existing) {
        if (existing.domain !== parsed.domain || existing.externalAccountId !== externalId) throw new ConflictError("El sitio ya está vinculado con otro dominio o cuenta");
        return existing;
      }
      if (await providerRepository.findDomain(provider.targetId, parsed.domain)) throw new ConflictError("Dominio ya vinculado");
      const sites = await providerRepository.listSitesForAccount(provider.id, externalId);
      if (sites.length >= account.maxDomains) throw new ForbiddenError("Cupo de dominios agotado");
      const marker = `${SITE_MARK}${provider.id}:${externalId}:${siteId}\n`;
      const generated = nginxSitesService.generateConfig(parsed);
      const content = marker + (siteId.startsWith("gh:") ? generated.replace("        proxy_pass ", "        proxy_buffering off;\n        proxy_read_timeout 3600s;\n        proxy_pass ") : generated);
      try {
        const current = await nginxSitesService.readRaw(executor, parsed.domain);
        if (current !== content) throw new ConflictError("Existe una configuración NGINX ajena para ese dominio");
      } catch (err) {
        if (!(err instanceof NotFoundError)) throw err;
      }
      await nginxSitesService.createSiteRaw(executor, parsed.domain, content, true);
      return providerRepository.createSite({ id: randomUUID(), providerId: provider.id,
        externalAccountId: externalId, externalSiteId: siteId, domain: parsed.domain,
        targetId: provider.targetId } as never);
    });
  },

  async unbindSite(provider: HostingProvider, externalId: string, siteId: string) {
    assertReference(siteId);
    const site = await providerRepository.findSite(provider.id, siteId);
    if (!site || site.externalAccountId !== externalId) throw new NotFoundError("Sitio de proveedor");
    return withLock(`${provider.targetId}:domain:${site.domain}`, async () => {
      const { executor } = await ownedAccount(provider, externalId);
      const current = await nginxSitesService.readRaw(executor, site.domain);
      if (!current.startsWith(`${SITE_MARK}${provider.id}:${externalId}:${siteId}\n`)) throw new ConflictError("La configuración NGINX cambió; requiere revisión administrativa");
      await nginxSitesService.deleteSite(executor, site.domain);
      await providerRepository.deleteSite(site.id);
    });
  },

  async issueHandoff(provider: HostingProvider, externalId: string) {
    const { account, executor } = await ownedAccount(provider, externalId);
    if (account.status !== "active" || (account.expiresAt && Date.parse(account.expiresAt) <= Date.now())) throw new ForbiddenError("Cuenta inactiva");
    const settings = await securitySettingsService.read(executor);
    // Provider assertions cannot silently bypass a panel-wide MFA policy.
    if (settings.requireTwoFa) throw new ForbiddenError("El panel exige segundo factor; configura acceso local a esta cuenta");
    const panelUser = await runWithExecutor(executor, () => panelUserRepository.findByUsername(account.username));
    if (!panelUser) throw new NotFoundError("Usuario del panel");
    if (!panelUser.enabled) throw new ForbiddenError("Usuario del panel deshabilitado");
    const totp = await runWithExecutor(executor, () => totpRepository.getByUser(panelUser.id));
    if (totp?.enabled) throw new ForbiddenError("La cuenta exige segundo factor; usa el ingreso local del panel");
    // Resolve real membership on every entry, exactly as normal Linux login.
    // Never copy the provider's initial module/template snapshot into a session.
    const groups = await runWithExecutor(executor, () => systemAccountsService.userGroups(panelUser.username));
    const tenant = {
      tenantId: account.id,
      owner: account.username, tenantGroup: account.tenantGroup, homeRoot: account.homeRoot,
      maxSubUsers: account.maxSubUsers, maxDomains: account.maxDomains,
      maxEmailAccounts: account.maxEmailAccounts, maxDatabases: account.maxDatabases,
      diskQuotaMb: account.diskQuotaMb, bandwidthQuotaMb: account.bandwidthQuotaMb,
      jailEnabled: account.jailEnabled,
    };
    const local = provider.targetId === LOCAL_TARGET_ID;
    const target = local ? null : await targetsRepository.getMaterial(provider.targetId);
    if (!local && (!target?.target.hostFingerprint || !target.target.enabled)) throw new ForbiddenError("Servidor no disponible");
    const bridgeSessionId = randomUUID();
    const session = await authSessionService.issueSession({
      ...panelUser, groups, tenant,
      bridge: { bridgeSessionId, targetId: provider.targetId, targetName: target?.target.name ?? "Local",
        sshUsername: panelUser.username, executor, local },
    }, false);
    if (session.mfaPending || !session.token) throw new ForbiddenError("La cuenta exige segundo factor; usa el ingreso local del panel");
    if (target) {
      await sshCredentialsCache.put(bridgeSessionId, { ...target.material,
        owner: account.username, homeRoot: account.homeRoot, jailEnabled: account.jailEnabled,
        tenantGroup: account.tenantGroup, userId: panelUser.id,
        targetId: provider.targetId, targetName: target.target.name },
        Math.max(1, Math.ceil(((session.expiresAt ?? Date.now()) - Date.now()) / 1000)));
    }
    const ticket = await ssoHandoffService.mint({ token: session.token, expiresAt: session.expiresAt, remember: false });
    return { url: `${provider.panelUrl}/api/auth/sso/handoff`, ticket, expiresInSeconds: 60 };
  },
};
