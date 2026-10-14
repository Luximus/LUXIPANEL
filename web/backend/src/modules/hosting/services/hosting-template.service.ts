import { runWithExecutor } from "../../../shared/executor/context.js";
import { providerRepository } from "../repositories/provider.repository.js";
import { authorizationChanged } from "../../../shared/auth/authorization-revision.js";
import { randomUUID } from "node:crypto";
import type { Executor } from "../../../shared/executor/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { actionRequiresAdmin } from "../../../shared/auth/module-actions.js";
import { deriveModulesFromPermissions, normalizeRolePermissions, getRolePermissionsCatalog } from "../../../shared/auth/role-permissions.js";
import { hostingTemplateStore } from "../repositories/hosting-template.repository.js";
import { hostingAccountRepository } from "../repositories/hosting-account.repository.js";
import { roleRepository } from "../../users/repositories/role.repository.js";
import { hostingTemplateInput, type HostingTemplate, type HostingTemplateInput } from "../models/hosting-template.model.js";
import type { HostingAccount } from "../models/hosting-account.model.js";
import { instantiateProviderGroupTemplate, normalizeProviderGroupTemplate } from "./provider-group-policy.js";
import { rebaseHostingPermissions, projectHostingLimits, hostingPermissionOverrides } from "./hosting-template-policy.js";
import { hostingRuntimeService } from "./hosting-runtime.service.js";
import { assertHostingPolicyLease, withHostingPolicyLock } from "./hosting-policy-lock.js";

async function locked<T>(executor: Executor, _id: string, fn: (assertHeld: () => Promise<void>) => Promise<T>): Promise<T> {
  return withHostingPolicyLock(executor, () => fn(assertHostingPolicyLease));
}
function validate(raw: unknown): HostingTemplateInput {
  const input = hostingTemplateInput.parse(raw);
  const modules = deriveModulesFromPermissions(input.permissions);
  input.permissions = normalizeProviderGroupTemplate(input.permissions, modules);
  const catalog = getRolePermissionsCatalog();
  if (input.permissions.actions.some(a => actionRequiresAdmin(a) || catalog.actionMetadata[a]?.adminOnly) || catalog.modules.some(m => m.actions.length > 0 && m.actions.every(a => catalog.actionMetadata[a]?.adminOnly) && modules.includes(m.module))) throw new ValidationError("Hosting plans cannot grant server administrator actions");
  if (input.permissions.commandPolicy.allowAll) throw new ValidationError("Hosting plans require an explicit command policy");
  input.permissions.version = 2;
  return input;
}

export const hostingTemplateService = {
  list(executor: Executor) { return hostingTemplateStore(executor).list(); },
  async get(executor: Executor, id: string): Promise<HostingTemplate> {
    const plan = await hostingTemplateStore(executor).get(id);
    if (!plan) throw new NotFoundError("Hosting template");
    return plan;
  },
  async create(executor: Executor, raw: unknown) {
    const input = validate(raw), now = new Date().toISOString();
    return hostingTemplateStore(executor).create({ ...input, id: randomUUID(), revision: 1, createdAt: now, updatedAt: now });
  },
  async update(executor: Executor, id: string, expectedRevision: number, raw: unknown) {
    return locked(executor, id, async (assertHeld) => {
      const current = await this.get(executor, id);
      if (current.revision !== expectedRevision) throw new ConflictError("Template changed; reload before saving");
      const next = { ...current, ...validate(raw), revision: current.revision + 1, updatedAt: new Date().toISOString() };
      const { rows } = await hostingAccountRepository.findAll({ limit: Number.MAX_SAFE_INTEGER }, executor);
      const linked = rows.filter(a => a.templateId === id && a.status !== "terminated");
      // Fence native shells/jobs BEFORE publishing the new policy.
      for (const account of linked) {
        await assertHeld();
        await hostingAccountRepository.update(account.id, { policyState: "pending" }, executor);
        await hostingRuntimeService.invalidate(executor, account);
      }
      await assertHeld();
      await hostingTemplateStore(executor).set(id, next);
      // The authoritative template changes FIRST. Authorization resolves this
      // revision immediately; projections/runtime are reconciled afterwards.
      await authorizationChanged(executor.target.id);
      eventBus.emit(Events.ROLE_UPDATED, { roleId: 0 });
      const results = [];
      for (const account of linked) {
        try { await this.reconcile(executor, account, next); results.push({ accountId: account.id, state: "ready" }); }
        catch { await hostingAccountRepository.update(account.id, { policyState: "pending" }, executor); results.push({ accountId: account.id, state: "pending" }); }
      }
      return { template: next, accounts: results };
    });
  },
  async remove(executor: Executor, id: string) {
    return locked(executor, id, async (assertHeld) => {
      const { rows } = await hostingAccountRepository.findAll({ limit: Number.MAX_SAFE_INTEGER }, executor);
      if (rows.some(a => a.templateId === id && a.status !== "terminated")) throw new ConflictError("Template is used by hosting accounts");
      if ((await providerRepository.list()).some(p => p.templateId === id && p.targetId === executor.target.id)) throw new ConflictError("Template is a provider default");
      await assertHeld();
      return hostingTemplateStore(executor).delete(id);
    });
  },
  async project(executor: Executor, account: HostingAccount, plan?: HostingTemplate) {
    if (!account.templateId) return account;
    const template = plan ?? await this.get(executor, account.templateId);
    const nextBase = instantiateProviderGroupTemplate(template.permissions, deriveModulesFromPermissions(template.permissions), account.homeRoot);
    const group = await roleRepository.findByName(account.tenantGroup, executor);
    const previous = account.templateBase ?? account.permissionTemplate;
    const own = normalizeRolePermissions(group?.permissions ?? previous);
    const overrides = account.permissionOverrides ?? hostingPermissionOverrides(previous, own);
    const permissions = rebaseHostingPermissions(previous, own, nextBase, overrides);
    const limits = projectHostingLimits(template.limits, account.limitOverrides);
    return { ...account, ...limits, permissionOverrides: overrides, resourceLimits: limits, security: template.security,
      permissionTemplate: permissions, allowedModules: deriveModulesFromPermissions(permissions),
      jailEnabled: template.security.shell === "jailed", templateRevision: template.revision,
      policyState: account.runtimeRevision === template.revision ? account.policyState ?? "ready" : "pending",
    } as HostingAccount;
  },
  async reconcile(executor: Executor, account: HostingAccount, plan?: HostingTemplate) {
    const template = plan ?? await this.get(executor, account.templateId!);
    const projected = await this.project(executor, account, template);
    await hostingAccountRepository.update(account.id, { policyState: "pending" }, executor);
    await authorizationChanged(executor.target.id);
    await hostingRuntimeService.invalidate(executor, account);
    try {
    await runWithExecutor(executor, () => hostingRuntimeService.apply(executor, projected, template.revision));
    const group = await roleRepository.findByName(account.tenantGroup, executor);
    if (!group) throw new ValidationError("Hosting group missing");
    await roleRepository.update(group.id, { permissions: projected.permissionTemplate as unknown as Record<string, unknown>, modules: projected.allowedModules }, executor);
    await hostingAccountRepository.update(account.id, {
      ...projected.resourceLimits!, resourceLimits: projected.resourceLimits, runtimeCapabilities: projected.runtimeCapabilities, security: template.security,
      allowedModules: projected.allowedModules, permissionTemplate: projected.permissionTemplate,
      permissionOverrides: projected.permissionOverrides,
      templateBase: instantiateProviderGroupTemplate(template.permissions, deriveModulesFromPermissions(template.permissions), account.homeRoot),
      templateRevision: template.revision, runtimeRevision: template.revision, policyState: "ready", jailEnabled: projected.jailEnabled,
    }, executor);
    if (account.status !== "active") await hostingRuntimeService.invalidate(executor, account);
    await authorizationChanged(executor.target.id);
    eventBus.emit(Events.ROLE_UPDATED, { roleId: group.id });
    } catch (error) {
      await hostingRuntimeService.invalidate(executor, account);
      throw error;
    }
  },
};

for (const method of ["update", "remove", "reconcile"] as const) {
  const handler = hostingTemplateService[method] as (executor: Executor, ...args: any[]) => Promise<unknown>;
  (hostingTemplateService as unknown as Record<string, (...args: any[]) => Promise<unknown>>)[method] = (executor: Executor, ...args: any[]) => withHostingPolicyLock(executor, () => handler.call(hostingTemplateService, executor, ...args));
}
