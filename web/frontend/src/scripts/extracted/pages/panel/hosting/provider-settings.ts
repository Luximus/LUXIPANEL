import { permissionLabel, permissionModuleLabel, type PolicyCatalog } from "/scripts/extracted/lib/permission-editor.js?v=20260930-permission-labels";
import { resolvePanelApiPath, scopeHeaders } from "/scripts/extracted/lib/api-client.js";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { baseGroupTemplate, setModuleSelection, type GroupTemplate, type ModuleSurface } from "./provider-policy";

type Catalog = PolicyCatalog & { modules: ModuleSurface[]; descriptions: Record<string,string> };
type Provider = Record<string, any> & { id: string; name: string; allowedModules: string[]; groupTemplate: GroupTemplate; operations: string[] };
const quotaDefaults = { diskQuotaMb: 10240, bandwidthQuotaMb: 102400, maxDomains: 10, maxEmailAccounts: 20, maxDatabases: 0, maxSubUsers: 0 };
const operations = ["accounts.read", "accounts.write", "accounts.status", "usage.read", "sites.write", "access.issue", "accounts.delete", "expo.read", "expo.write", "expo.build", "expo.submit"];
const { loadI18n, t } = createPageI18n("hosting-i18n");

export function initProviderSettings(): void {
  const root = document.getElementById("hosting-settings-modal");
  if (!root || root.dataset.providerSettingsBound) return;
  root.dataset.providerSettingsBound = "true";
  loadI18n();
  const el = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const input = (id: string) => el<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`provider-${id}`);
  const p = (key: string) => t(`settingsUi.groupPolicy.${key}`, key);
  const hs = (key: string) => t(`settingsUi.${key}`, key);
  const status = (message: string, failed = false) => { el("hosting-provider-status").textContent = message; el("hosting-provider-status").classList.toggle("text-destructive", failed); };
  const fields = el<HTMLFieldSetElement>("provider-fields");
  let catalog: Catalog | undefined;
  let editing: Provider | undefined;
  let modules = ["files", "mail", "dns", "backups", "cron"];
  let template = baseGroupTemplate();
  let loaded = false, loading = false, busy = false;
  let generation = 0;
  const request = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(resolvePanelApiPath(path), { ...options, signal: AbortSignal.timeout(20000), headers: { ...scopeHeaders(Boolean(options.method && options.method !== "GET")), ...options.headers } });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(typeof json.error === "string" ? json.error : json.message || `HTTP ${response.status}`);
    return json.data;
  };
  let templateTicket = 0;
  const loadTemplates = async (selected = "") => {
    const ticket = ++templateTicket, target = input("target").value;
    input("template-id").disabled = true;
    try {
      const plans = await request(`/api/hosting/providers/templates?targetId=${encodeURIComponent(target)}`);
      if (ticket !== templateTicket || !root.isConnected || target !== input("target").value) return;
      const select = input("template-id") as HTMLSelectElement, legacy = select.options[0].cloneNode(true);
      select.replaceChildren(legacy, ...plans.map((plan: any) => { const option = document.createElement("option"); option.value = plan.id; option.textContent = `${plan.name} · v${plan.revision}`; return option; }));
      select.value = selected;
      if (selected && select.value !== selected) throw new Error("Hosting plan unavailable");
    } catch (error) { status(error instanceof Error ? error.message : String(error), true); }
    finally { if (ticket === templateTicket) input("template-id").disabled = false; }
  };
  const lineValues = (key: string) => input(key).value.split("\n").map(s => s.trim()).filter(Boolean);
  const showKey = (key: string) => { el("hosting-provider-key").textContent = key; el("hosting-provider-key-box").classList.remove("hidden"); };
  const checkbox = (text: string, checked: boolean, change: (value: boolean) => void) => {
    const label = document.createElement("label"); label.className = "flex items-start gap-2 text-xs";
    const check = document.createElement("input"); check.type = "checkbox"; check.checked = checked; check.className = "mt-0.5 shrink-0";
    check.addEventListener("change", () => change(check.checked));
    const span = document.createElement("span"); span.className = "min-w-0 break-words"; span.textContent = text;
    label.append(check, span); return label;
  };
  const renderPermissions = () => {
    if (!catalog) return;
    const picker = el("provider-module-picker");
    const openModules = new Set([...picker.querySelectorAll<HTMLDetailsElement>("details[open]")].map(d => d.dataset.module));
    picker.replaceChildren();
    for (const surface of catalog.modules) {
      const box = document.createElement("div"); box.className = "rounded-lg border border-border p-3";
      const master = checkbox(permissionModuleLabel(surface.module, catalog), modules.includes(surface.module), enabled => { modules = setModuleSelection(template, modules, surface, enabled, catalog!.modules); renderPermissions(); });
      master.querySelector("input")!.dataset.providerModule = surface.module;
      master.classList.add("font-medium"); box.append(master);
      if (modules.includes(surface.module)) {
        const details = document.createElement("details"); details.dataset.module = surface.module; details.open = openModules.has(surface.module);
        const summary = document.createElement("summary"); summary.textContent = p("permissions"); summary.className = "mt-2 cursor-pointer text-xs text-muted-foreground"; details.append(summary);
        for (const field of ["sidebar", "views", "actions"] as const) {
          if (!surface[field].length) continue;
          const section = document.createElement("fieldset"); section.className = "mt-3 grid grid-cols-1 gap-2 @xl:grid-cols-2";
          const legend = document.createElement("legend"); legend.className = "mb-2 text-xs font-medium"; legend.textContent = p(field); section.append(legend);
          for (const id of surface[field]) {
            const choice = checkbox(permissionLabel(id, catalog, field), template[field].includes(id), enabled => {
              template[field] = enabled ? [...new Set([...template[field],id])] : template[field].filter(v => v !== id);
              // Refresh duplicate surfaces without collapsing their details.
              renderPermissions();
            });
            if (field === "actions" && catalog.actionMetadata?.[id]?.adminOnly) { const cb = choice.querySelector("input")!; cb.disabled = true; cb.checked = false; template.actions = template.actions.filter(a => a !== id); }
            choice.querySelector("input")!.dataset.permission = `${field}:${id}`; section.append(choice);
          }
          details.append(section);
        }
        box.append(details);
      }
      picker.append(box);
    }
  };
  const fill = (provider?: Provider) => {
    editing = provider;
    modules = provider ? [...provider.allowedModules] : ["files", "mail", "dns", "backups", "cron"];
    template = provider ? structuredClone(provider.groupTemplate) : baseGroupTemplate();
    if (!provider) for (const surface of catalog!.modules.filter(m => modules.includes(m.module))) setModuleSelection(template,modules,surface,true,catalog!.modules);
    for (const [key,value] of Object.entries({ name:"", target:"local", "panel-url":"", upstream:"http://127.0.0.1:3400", plan:"basic", ...quotaDefaults })) {
      const map: Record<string,string> = { target:"targetId", "panel-url":"panelUrl", upstream:"upstreamUrl" };
      input(key).value = String(provider?.[map[key] || key] ?? value);
    }
    input("target").disabled = Boolean(provider);
    void loadTemplates(provider?.templateId ?? "");
    (input("jailEnabled") as HTMLInputElement).checked = Boolean(provider?.jailEnabled);
    for (const key of ["allowPaths","denyPaths","readOnlyPaths"] as const) input(key).value = template.fileAccess[key].join("\n");
    input("defaultPath").value = template.fileAccess.defaultPath ?? "";
    for (const key of ["allowCommands","denyCommands"] as const) input(key).value = template.commandPolicy[key].join("\n");
    (input("allowAllCommands") as HTMLInputElement).checked = template.commandPolicy.allowAll;
    el("provider-command-groups").replaceChildren(...catalog!.commandGroups.map(id => checkbox(permissionLabel(id, catalog!, "commands"),template.commandPolicy.groups.includes(id), enabled => { template.commandPolicy.groups = enabled ? [...new Set([...template.commandPolicy.groups,id])] : template.commandPolicy.groups.filter(g => g !== id); })));
    el("provider-operations").replaceChildren(...operations.map((op,i) => {
      const labels = ["readAccounts","createAccounts","accountStatus","viewUsage","linkSites","panelAccess","deleteAccounts"];
      const choice = checkbox(labels[i] ? hs(labels[i]!) : permissionLabel(op, catalog!, "actions"), provider ? provider.operations.includes(op) : i < 6, () => {});
      choice.querySelector("input")!.dataset.providerOperation = op; return choice;
    }));
    el("provider-form-title").textContent = provider ? `${p("editProvider")} · ${provider.name}` : hs("newProvider");
    el("provider-submit").textContent = provider ? p("saveProvider") : hs("createProviderKey");
    el("provider-cancel-edit").classList.toggle("hidden", !provider);
    el("hosting-provider-key").textContent = ""; el("hosting-provider-key-box").classList.add("hidden");
    renderPermissions();
  };
  const rowButton = (label: string, handler: () => Promise<void> | void) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"; button.textContent = label;
    button.addEventListener("click", async () => {
      if (busy) return; busy = true; button.disabled = true; fields.disabled = true;
      try { await handler(); } catch (err) { status(err instanceof Error ? err.message : String(err),true); }
      finally { busy=false; button.disabled=false; fields.disabled = !loaded; }
    }); return button;
  };
  const renderProviders = (providers: Provider[]) => {
    const list = el("hosting-provider-list"); list.replaceChildren();
    for (const provider of providers) {
      const row = document.createElement("div"); row.className = "rounded-xl border border-border p-3";
      const title = document.createElement("p"); title.className = "font-medium break-words"; title.textContent = `${provider.name} · ${p(provider.enabled ? "active" : "revoked")}`;
      const detail = document.createElement("p"); detail.className = "mt-1 break-all text-xs text-muted-foreground"; detail.textContent = `${hs("managedServer")}: ${provider.targetId} · ${provider.allowedModules.join(", ")}`;
      const buttons = document.createElement("div"); buttons.className = "mt-3 flex flex-wrap gap-2";
      buttons.append(rowButton(p("editProvider"), () => { fill(provider); el("provider-form-title").scrollIntoView({block:"nearest"}); }),
        rowButton(p("rotateKey"),async () => { const data = await request(`/api/hosting/providers/${encodeURIComponent(provider.id)}/rotate`,{method:"POST"});showKey(data.key);status(p("rotateSuccess"));await refreshList(); }),
        rowButton(p(provider.enabled?"revoke":"reactivate"),async () => { await request(`/api/hosting/providers/${encodeURIComponent(provider.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:!provider.enabled})});status(p("accessUpdated"));await refreshList(); }));
      row.append(title,detail,buttons); list.append(row);
    }
    if (!providers.length) list.textContent = p("emptyProviders");
  };
  const refreshList = async () => renderProviders(await request("/api/hosting/providers"));
  const load = async () => {
    if (loaded || loading) return; loading = true; fields.disabled = true; const gen=++generation;
    status(p("loading")); el("provider-retry").classList.add("hidden");
    try {
      const [providers, cats, targets] = await Promise.all([request("/api/hosting/providers"),request("/api/hosting/providers/permission-catalog"),request("/api/servers")]);
      if (!root.isConnected || gen!==generation) return;
      catalog=cats;
      const select = input("target") as HTMLSelectElement; select.replaceChildren(new Option(hs("localServer"),"local"));
      for (const target of targets) if (target.id!=="local" && target.enabled && target.hostFingerprint) select.add(new Option(target.name,target.id));
      loaded=true;renderProviders(providers);fill();status("");
    } catch(err) { status(err instanceof Error ? err.message : p("loadError"),true);el("provider-retry").classList.remove("hidden"); }
    finally { loading=false;fields.disabled=!loaded; }
  };
  root.querySelectorAll<HTMLElement>("[data-hosting-settings-nav]").forEach(button => button.addEventListener("click",() => {
    const view=button.dataset.hostingSettingsNav;
    root.querySelectorAll<HTMLElement>("[data-hosting-settings-nav]").forEach(item=>{const active=item===button;item.classList.toggle("bg-primary/10",active);item.classList.toggle("text-primary",active);item.classList.toggle("text-muted-foreground",!active);item.setAttribute("aria-current",active?"page":"false");});
    root.querySelectorAll<HTMLElement>("[data-hosting-settings-view]").forEach(section=>section.classList.toggle("hidden",section.dataset.hostingSettingsView!==view));
    if (view==="providers") void load();
  }));
  input("target").addEventListener("change", () => void loadTemplates());
  el("provider-retry").addEventListener("click",()=>void load());
  el("provider-cancel-edit").addEventListener("click",()=>{if(!busy)fill();});
  el<HTMLFormElement>("hosting-provider-form").addEventListener("submit",async event=>{
    event.preventDefault();if(!loaded||busy)return;
    const value=(key:string)=>input(key).value.trim();
    template.fileAccess={allowAll:false,allowPaths:lineValues("allowPaths"),denyPaths:lineValues("denyPaths"),readOnlyPaths:lineValues("readOnlyPaths"),defaultPath:value("defaultPath")||null};
    template.commandPolicy={...template.commandPolicy,allowAll:(input("allowAllCommands") as HTMLInputElement).checked,allowCommands:lineValues("allowCommands"),denyCommands:lineValues("denyCommands")};
    const body: Record<string,unknown>={name:value("name"),panelUrl:value("panel-url"),upstreamUrl:value("upstream"),plan:value("plan"),allowedModules:modules,groupTemplate:template,jailEnabled:(input("jailEnabled") as HTMLInputElement).checked,operations:[...root.querySelectorAll<HTMLInputElement>("[data-provider-operation]:checked")].map(node=>node.dataset.providerOperation)};
    for(const key of Object.keys(quotaDefaults))body[key]=Number(value(key));
    body.templateId = value("template-id") || null;
    if (body.templateId) delete body.groupTemplate;
    if(!editing)body.targetId=value("target");
    busy=true;fields.disabled=true;status(p("saving"));
    try{
      const current=editing;
      const data=await request(current?`/api/hosting/providers/${encodeURIComponent(current.id)}`:"/api/hosting/providers",{method:current?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(current)fill(data);else{fill(data.provider);showKey(data.key);}
      status(p(current?"saved":"created"));await refreshList();
    }catch(err){status(err instanceof Error?err.message:String(err),true);}
    finally{busy=false;fields.disabled=false;}
  });
}
document.addEventListener("astro:page-load",initProviderSettings);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initProviderSettings,{once:true});else initProviderSettings();
