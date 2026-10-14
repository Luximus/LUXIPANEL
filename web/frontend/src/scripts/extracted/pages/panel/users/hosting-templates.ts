import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { renderPolicyMatrix, collectPolicyMatrix, permissionLabel, type PolicyCatalog } from "/scripts/extracted/lib/permission-editor.js?v=20260930-permission-labels";
const locale = createPageI18n("permissions-i18n");
export function bindHostingTemplates() {
  const dialog = document.getElementById("hosting-plans-dialog") as HTMLDialogElement | null;
  if (!dialog || dialog.dataset.bound) return;
  dialog.dataset.bound = "true"; locale.loadI18n();
  const el = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#hosting-plan-${id}`)!;
  const form = el<HTMLFormElement>("form"), fields = el<HTMLFieldSetElement>("fields");
  let catalog: PolicyCatalog, plans: any[] = [], current: any = null, scope = "", generation = 0, busy = false;
  const status = (text: string, error = false) => { el("status").textContent = text; el("status").classList.toggle("text-destructive", error); };
  const assert = (res: any) => { if (!res.ok) throw new Error(res.error ?? locale.t("loadFailed", "")); return res.data?.items ?? res.data; };
  const defaults = () => ({ name: "", permissions: { version: 2, sidebar: [], views: [], actions: [], fileAccess: { allowAll: false, allowPaths: ["."], denyPaths: [], readOnlyPaths: [], defaultPath: "." }, commandPolicy: { allowAll: false, groups: [], allowCommands: [], denyCommands: [] } }, limits: { diskQuotaMb: 10240, maxDomains: 10, maxEmailAccounts: 20, maxDatabases: 5, maxSubUsers: 10, cpuPercent: 100, memoryMb: 1024, maxProcesses: 128 }, security: { shell: "disabled", maxTerminalSessions: 2, commandTimeoutSeconds: 120, sessionHours: 24, requireMfa: false, mailTargetIds: [] } });
  const fill = (plan: any) => {
    current = plan?.id ? structuredClone(plan) : null; plan ??= defaults();
    fields.disabled = false; status(""); el<HTMLInputElement>("name").value = plan.name;
    renderPolicyMatrix(el("permissions"), catalog, plan.permissions, true);
    for (const [selector, object] of [["limit", plan.limits], ["security", plan.security]] as const) dialog.querySelectorAll<HTMLInputElement>(`[data-plan-${selector}]`).forEach(input => input.value = String(object[input.dataset[selector === "limit" ? "planLimit" : "planSecurity"]!]));
    dialog.querySelectorAll<HTMLTextAreaElement>("[data-plan-path]").forEach(input => input.value = plan.permissions.fileAccess[input.dataset.planPath!].join("\n"));
    dialog.querySelectorAll<HTMLTextAreaElement>("[data-plan-command]").forEach(input => input.value = plan.permissions.commandPolicy[input.dataset.planCommand!].join("\n"));
    el<HTMLInputElement>("default-path").value = plan.permissions.fileAccess.defaultPath ?? "";
    el<HTMLSelectElement>("shell").value = plan.security.shell; el<HTMLInputElement>("mfa").checked = plan.security.requireMfa;
    el<HTMLTextAreaElement>("mail-targets").value = plan.security.mailTargetIds.join("\n"); el<HTMLButtonElement>("delete").disabled = !current;
    el("command-groups").replaceChildren(...catalog.commandGroups.map(id => { const label = document.createElement("label"), input = document.createElement("input"); input.type = "checkbox"; input.dataset.planGroup = id; input.checked = plan.permissions.commandPolicy.groups.includes(id); label.className = "flex items-center gap-2"; label.append(input, document.createTextNode(permissionLabel(id, catalog, "commands"))); return label; }));
  };
  const renderList = () => el("list").replaceChildren(...plans.map(plan => { const button = document.createElement("button"); button.type = "button"; button.className = "w-full rounded-lg border border-border p-3 text-start text-sm hover:bg-accent"; button.textContent = plan.name; const revision = document.createElement("small"); revision.className = "block font-mono text-muted-foreground"; revision.textContent = `v${plan.revision}`; button.append(revision); button.onclick = () => { if (!busy) fill(plan); }; return button; }));
  document.getElementById("hosting-plans-close")?.addEventListener("click", () => dialog.close());
  document.getElementById("btn-hosting-plans")?.addEventListener("click", async () => {
    if (busy) return; const ticket = ++generation; scope = resolveTargetScope(); fields.disabled = true; dialog.showModal(); status("");
    try {
      const [list, cat, caps] = await Promise.all([api.get("/api/roles/templates"), api.get("/api/roles/permission-catalog"), api.get("/api/roles/templates/capabilities")]);
      if (ticket !== generation || scope !== resolveTargetScope() || !dialog.isConnected) return;
      plans = assert(list); catalog = assert(cat); const capabilities = assert(caps);
      el("capabilities").textContent = capabilities.cpu && capabilities.memory && capabilities.processes && capabilities.jail && capabilities.disk ? locale.t("ready", "") : locale.t("unavailable", "");
      renderList(); fill(plans[0] ?? defaults());
    } catch (error) { status(String(error instanceof Error ? error.message : error), true); }
  });
  el("new").addEventListener("click", () => { if (catalog && !busy) fill(defaults()); });
  const lines = (input: HTMLInputElement | HTMLTextAreaElement) => input.value.split("\n").map(v => v.trim()).filter(Boolean);
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (busy || scope !== resolveTargetScope()) return;
    const permissions: any = { ...collectPolicyMatrix(el("permissions")), fileAccess: { allowAll: false, defaultPath: el<HTMLInputElement>("default-path").value.trim() || null }, commandPolicy: { allowAll: false, groups: [...dialog.querySelectorAll<HTMLInputElement>("[data-plan-group]:checked")].map(i => i.dataset.planGroup) } };
    dialog.querySelectorAll<HTMLTextAreaElement>("[data-plan-path]").forEach(i => permissions.fileAccess[i.dataset.planPath!] = lines(i));
    dialog.querySelectorAll<HTMLTextAreaElement>("[data-plan-command]").forEach(i => permissions.commandPolicy[i.dataset.planCommand!] = lines(i));
    const limits: any = {}, security: any = { shell: el<HTMLSelectElement>("shell").value, requireMfa: el<HTMLInputElement>("mfa").checked, mailTargetIds: lines(el<HTMLTextAreaElement>("mail-targets")) };
    dialog.querySelectorAll<HTMLInputElement>("[data-plan-limit]").forEach(i => limits[i.dataset.planLimit!] = Number(i.value));
    dialog.querySelectorAll<HTMLInputElement>("[data-plan-security]").forEach(i => security[i.dataset.planSecurity!] = Number(i.value));
    const body = { name: el<HTMLInputElement>("name").value, permissions, limits, security };
    busy = true; fields.disabled = true; status(locale.t("saving", ""));
    try {
      const result = assert(current ? await api.put(`/api/roles/templates/${encodeURIComponent(current.id)}`, { ...body, expectedRevision: current.revision }) : await api.post("/api/roles/templates", body));
      if (scope !== resolveTargetScope() || !dialog.isConnected) return;
      const saved = result.template ?? result; plans = plans.filter(p => p.id !== saved.id); plans.push(saved); renderList(); fill(saved);
      status(result.accounts?.some((a: any) => a.state !== "ready") ? locale.t("pending", "") : locale.t("saved", ""));
    } catch (error) { status(String(error instanceof Error ? error.message : error), true); }
    finally { busy = false; fields.disabled = scope !== resolveTargetScope(); }
  });
  el("delete").addEventListener("click", async () => {
    if (!current || busy || scope !== resolveTargetScope()) return; const id = current.id; busy = true; fields.disabled = true;
    try { assert(await api.delete(`/api/roles/templates/${encodeURIComponent(id)}`)); if (scope !== resolveTargetScope()) return; plans = plans.filter(p => p.id !== id); renderList(); fill(plans[0] ?? defaults()); }
    catch (error) { status(String(error instanceof Error ? error.message : error), true); }
    finally { busy = false; fields.disabled = scope !== resolveTargetScope(); }
  });
  const targetChanged = () => {
    if (!dialog.isConnected) { window.removeEventListener("luxipanel:target-changed", targetChanged); return; }
    generation++; fields.disabled = true; catalog = undefined as unknown as PolicyCatalog; plans = []; current = null; el("list").replaceChildren();
    if (dialog.open) dialog.close();
  };
  window.addEventListener("luxipanel:target-changed", targetChanged);
}
