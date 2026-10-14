import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
  import { watchModuleData } from "/scripts/extracted/lib/live-data.js";
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
  import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
  import { DATATABLE_EVENTS, createTableFeed } from "/scripts/extracted/lib/datatable-events.js";
  import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
  import { openDialog, switchView } from "/scripts/extracted/lib/dom.js";
  import { tabDirectionOf } from "/scripts/extracted/lib/tabs.js";
  import { TOAST_LEGACY_MS, showToast as showSharedToast } from "/scripts/extracted/lib/toast.js";
  import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
  import { escapeHtml } from "/scripts/extracted/lib/escape.js";
const discoveredPages = createTablePages({ tableId: "discovered-table", events: window, scope: resolveTargetScope, reload: () => loadDiscovered(), field: "auto", aliases:{origen:"source",estado:"enabled"},values:()=>({origen:Object.fromEntries(["sidecar","git-hook","nginx","cron","systemd","config","project"].map(source=>[localizedSource(source),source])),estado:{[discoveredEstado(true)]:"true",[discoveredEstado(false)]:"false"}}) });
const keyPages = createTablePages({ tableId: "apikeys-table", events: window, scope: resolveTargetScope, reload: () => loadKeys(), field: "auto", aliases:{creada:"createdAt",expira:"expiresAt"} });
const webhookPages = createTablePages({ tableId: "webhooks-table", events: window, scope: resolveTargetScope, reload: () => loadWebhooks(), field: "auto", aliases:{estado:"webhookStatus"},values:()=>({estado:{[t("labels.statusActive","Activo")]:"active",[t("labels.statusPaused","Pausado")]:"paused",[t("labels.statusFailing","Fallando")]:"failing"}}) });
const gatewayPages = createTablePages({ tableId: "gateway-table", events: window, scope: resolveTargetScope, reload: () => loadGateways(), field: "auto", aliases:{recibidos:"receivedCount",ultima:"lastReceivedAt",estado:"enabled"},values:()=>({estado:{[t("gateway.cols.estadoActive","Activo")]:"true",[t("gateway.cols.estadoPaused","Pausado")]:"false"}}) });

  const { loadI18n, t, fmt } = createPageI18n("webhooks-i18n");
  const esc = escapeHtml;

  const GATEWAY_TABLE_ID = "gateway-table";
  const GW_DETECTED_TABLE_ID = "gw-detected-table";
  const WEBHOOKS_TABLE_ID = "webhooks-table";
  const APIKEYS_TABLE_ID = "apikeys-table";
  const DISCOVERED_TABLE_ID = "discovered-table";
  const feed = createTableFeed([GATEWAY_TABLE_ID, GW_DETECTED_TABLE_ID, WEBHOOKS_TABLE_ID, APIKEYS_TABLE_ID, DISCOVERED_TABLE_ID]);
  const publishRows = (tableId: string, rows: any[]) => feed.publish(tableId, rows);

  function showToast(msg: string, ok = true) {
    showSharedToast(msg, ok, { durationMs: TOAST_LEGACY_MS });
  }

  const PANEL_BY_TAB: Record<string, string> = {
    receive: "panel-receive",
    mailhook: "panel-mailhook",
    response: "panel-response",
    webhooks: "panel-webhooks",
    keys: "panel-keys",
    discovered: "panel-discovered",
  };

  function bindTabs() {
    let currentTab = "receive";
    const showTab = (tab: string) => {
      const tabButtons = document.querySelectorAll<HTMLButtonElement>("[data-tab]");
      const direction = tabDirectionOf(tabButtons, (b) => b.dataset.tab === currentTab, (b) => b.dataset.tab === tab);
      currentTab = tab;
      tabButtons.forEach((button) => {
        const active = button.dataset.tab === tab;
        button.className = active
          ? "rounded-lg px-4 py-2 text-sm font-medium transition-all bg-card text-foreground shadow-sm"
          : "rounded-lg px-4 py-2 text-sm font-medium transition-all text-muted-foreground hover:text-foreground";
        button.setAttribute("aria-selected", String(active));
      });
      const panels = Object.values(PANEL_BY_TAB).map((pid) => document.getElementById(pid));
      switchView(panels, document.getElementById(PANEL_BY_TAB[tab] ?? ""), { direction });
    };
    document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab!;
        showTab(tab);
        if (tab === "receive") { void loadGateways(); void loadDetectedReceivers(); }
        else if (tab === "webhooks") void loadWebhooks();
        else if (tab === "keys") void loadKeys();
        else if (tab === "discovered") void loadDiscovered();
      });
    });
    const requested = new URLSearchParams(location.search).get("workspaceView") || "receive";
    if (PANEL_BY_TAB[requested] && document.getElementById(PANEL_BY_TAB[requested])) showTab(requested);
  }

  // ── Gateway (receive-data, inbound) webhooks ────────────────
  let editGatewayId: number | null = null;
  const gatewaysById = new Map<number, any>();

  function dt(s: string | null | undefined): string {
    if (!s) return "—";
    try { return new Date(s).toLocaleString(document.documentElement.lang || undefined); } catch { return "—"; }
  }

  async function loadGateways() {
    const res = await gatewayPages.read<any>(params => api.get<any>("/api/webhooks/gateways", {params:{...params,category:"receive-data"}}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
    if (!res.ok) { publishRows(GATEWAY_TABLE_ID, []); return; }
    const items: any[] = (res.data as any)?.data ?? (res.data as any)?.items ?? res.data ?? [];
    gatewaysById.clear();
    const rows = items.map((g: any) => {
      gatewaysById.set(Number(g.id), g);
      const keys = Array.isArray(g.apiKeys) ? g.apiKeys.length : 0;
      return {
        name: String(g.name ?? ""),
        auth: keys > 0 ? `${keys} API key${keys > 1 ? "s" : ""}` : (g.ipRestrictions ? "IP" : "—"),
        recibidos: Number(g.receivedCount ?? 0),
        ultima: dt(g.lastReceivedAt),
        estado: g.enabled ? t("gateway.cols.estadoActive", "Activo") : t("gateway.cols.estadoPaused", "Pausado"),
        _id: Number(g.id),
        _url: String(g.ingestUrl ?? ""),
      };
    });
    publishRows(GATEWAY_TABLE_ID, rows);
  }

  // API key rows ----------------------------------------------------
  function apiKeyRowHtml(k?: { id?: string; name?: string; keyPrefix?: string }): string {
    const id = k?.id ? esc(k.id) : "";
    const name = k?.name ? esc(k.name) : "";
    const placeholder = k?.id ? t("gateway.dialog.apiKeyKeep", "(guardada — deja vacío para conservar)") : t("gateway.dialog.apiKeyValue", "Valor de la API key");
    return `<div class="gw-apikey-row flex items-center gap-2" data-id="${id}">
      <input class="gw-ak-name h-9 w-40 rounded-lg border border-input bg-background px-2 text-sm" placeholder="${esc(t("gateway.dialog.apiKeyName", "Nombre"))}" value="${name}" />
      <input class="gw-ak-value h-9 flex-1 rounded-lg border border-input bg-background px-2 text-sm" type="password" autocomplete="new-password" placeholder="${esc(placeholder)}" />
      <button type="button" class="gw-ak-remove rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent"><i class="ti ti-x text-sm"></i></button>
    </div>`;
  }
  function addApiKeyRow(k?: any) {
    const c = document.getElementById("gw-apikeys");
    if (!c) return;
    c.insertAdjacentHTML("beforeend", apiKeyRowHtml(k));
    c.querySelector<HTMLElement>(".gw-apikey-row:last-child .gw-ak-remove")?.addEventListener("click", (e) => {
      (e.currentTarget as HTMLElement).closest(".gw-apikey-row")?.remove();
    });
  }

  // Data-structure field rows --------------------------------------
  const DS_TYPES = ["text", "number", "boolean", "date", "array", "collection"];
  function dsRowHtml(f?: any): string {
    const opts = DS_TYPES.map((ty) => `<option value="${ty}"${f?.type === ty ? " selected" : ""}>${ty}</option>`).join("");
    return `<div class="gw-ds-row rounded-lg border border-border p-3 space-y-2">
      <div class="grid grid-cols-2 gap-2">
        <input class="gw-ds-name h-9 rounded-lg border border-input bg-background px-2 text-sm" placeholder="${esc(t("gateway.dialog.dsFieldName", "Nombre"))}" value="${f?.name ? esc(f.name) : ""}" />
        <select class="gw-ds-type h-9 rounded-lg border border-input bg-background px-2 text-sm">${opts}</select>
      </div>
      <input class="gw-ds-desc h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" placeholder="${esc(t("gateway.dialog.dsFieldDesc", "Descripción"))}" value="${f?.description ? esc(f.description) : ""}" />
      <input class="gw-ds-default h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" placeholder="${esc(t("gateway.dialog.dsFieldDefault", "Valor por defecto"))}" value="${f?.defaultValue ? esc(f.defaultValue) : ""}" />
      <div class="flex items-center gap-4 text-sm">
        <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" class="gw-ds-required h-4 w-4 rounded border-input text-primary"${f?.required ? " checked" : ""} />${esc(t("gateway.dialog.dsFieldRequired", "Requerido"))}</label>
        <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" class="gw-ds-multiline h-4 w-4 rounded border-input text-primary"${f?.multiline ? " checked" : ""} />${esc(t("gateway.dialog.dsFieldMultiline", "Multilínea"))}</label>
        <button type="button" class="gw-ds-remove ml-auto rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"><i class="ti ti-trash text-sm"></i></button>
      </div>
    </div>`;
  }
  function addDsRow(f?: any) {
    const c = document.getElementById("gw-ds-fields");
    if (!c) return;
    c.insertAdjacentHTML("beforeend", dsRowHtml(f));
    c.querySelector<HTMLElement>(".gw-ds-row:last-child .gw-ds-remove")?.addEventListener("click", (e) => {
      (e.currentTarget as HTMLElement).closest(".gw-ds-row")?.remove();
    });
  }

  function setDsVisible(on: boolean) {
    document.getElementById("gw-ds-section")?.classList.toggle("hidden", !on);
  }

  function openGatewayDialog(existing?: any) {
    editGatewayId = existing ? Number(existing.id) : null;
    document.getElementById("gw-dialog-title")!.textContent = existing
      ? t("gateway.dialog.titleEdit", "Editar webhook")
      : t("gateway.dialog.titleNew", "Crear un webhook");
    (document.getElementById("form-gateway") as HTMLFormElement).reset();
    document.getElementById("gw-error")!.classList.add("hidden");
    (document.getElementById("gw-name") as HTMLInputElement).value = existing?.name ?? "";
    (document.getElementById("gw-ips") as HTMLInputElement).value = existing?.ipRestrictions ?? "";
    (document.getElementById("gw-enabled") as HTMLInputElement).checked = existing ? !!existing.enabled : true;
    (document.getElementById("gw-get-headers") as HTMLInputElement).checked = !!existing?.getRequestHeaders;
    (document.getElementById("gw-get-method") as HTMLInputElement).checked = !!existing?.getRequestHttpMethod;
    (document.getElementById("gw-json-passthrough") as HTMLInputElement).checked = !!existing?.jsonPassThrough;

    // API keys
    const akc = document.getElementById("gw-apikeys")!;
    akc.innerHTML = "";
    (existing?.apiKeys ?? []).forEach((k: any) => addApiKeyRow(k));

    // Data structure
    const ds = existing?.dataStructure ?? null;
    const validate = !!(ds && Array.isArray(ds.fields) && ds.fields.length > 0);
    (document.getElementById("gw-ds-validate") as HTMLInputElement).checked = validate;
    (document.getElementById("gw-ds-strict") as HTMLInputElement).checked = !!ds?.strict;
    const dsc = document.getElementById("gw-ds-fields")!;
    dsc.innerHTML = "";
    (ds?.fields ?? []).forEach((f: any) => addDsRow(f));
    setDsVisible(validate);

    openDialog("dialog-gateway");
  }

  function collectGatewayPayload() {
    const apiKeys = Array.from(document.querySelectorAll<HTMLElement>("#gw-apikeys .gw-apikey-row")).map((row) => {
      const id = row.getAttribute("data-id") || undefined;
      const name = (row.querySelector(".gw-ak-name") as HTMLInputElement).value.trim();
      const value = (row.querySelector(".gw-ak-value") as HTMLInputElement).value;
      return { id, name, value: value || undefined };
    }).filter((k) => k.name);

    const validate = (document.getElementById("gw-ds-validate") as HTMLInputElement).checked;
    let dataStructure: any = null;
    if (validate) {
      const fields = Array.from(document.querySelectorAll<HTMLElement>("#gw-ds-fields .gw-ds-row")).map((row) => ({
        name: (row.querySelector(".gw-ds-name") as HTMLInputElement).value.trim(),
        description: (row.querySelector(".gw-ds-desc") as HTMLInputElement).value.trim(),
        type: (row.querySelector(".gw-ds-type") as HTMLSelectElement).value,
        defaultValue: (row.querySelector(".gw-ds-default") as HTMLInputElement).value,
        required: (row.querySelector(".gw-ds-required") as HTMLInputElement).checked,
        multiline: (row.querySelector(".gw-ds-multiline") as HTMLInputElement).checked,
      })).filter((f) => f.name);
      dataStructure = { strict: (document.getElementById("gw-ds-strict") as HTMLInputElement).checked, fields };
    }

    return {
      name: (document.getElementById("gw-name") as HTMLInputElement).value.trim(),
      category: "receive-data",
      enabled: (document.getElementById("gw-enabled") as HTMLInputElement).checked,
      ipRestrictions: (document.getElementById("gw-ips") as HTMLInputElement).value.trim(),
      apiKeys,
      dataStructure,
      getRequestHeaders: (document.getElementById("gw-get-headers") as HTMLInputElement).checked,
      getRequestHttpMethod: (document.getElementById("gw-get-method") as HTMLInputElement).checked,
      jsonPassThrough: (document.getElementById("gw-json-passthrough") as HTMLInputElement).checked,
    };
  }

  function revealUrl(url: string) {
    if (!url) return;
    const box = document.getElementById("gw-url-reveal")!;
    document.getElementById("gw-url-value")!.textContent = url;
    box.classList.remove("hidden");
  }

  function bindGatewayForm() {
    document.getElementById("btn-new-gateway")?.addEventListener("click", () => openGatewayDialog());
    document.getElementById("gw-close")?.addEventListener("click", () => (document.getElementById("dialog-gateway") as HTMLDialogElement).close());
    document.getElementById("gw-cancel")?.addEventListener("click", () => (document.getElementById("dialog-gateway") as HTMLDialogElement).close());
    document.getElementById("gw-add-apikey")?.addEventListener("click", () => addApiKeyRow());
    document.getElementById("gw-ds-add")?.addEventListener("click", () => addDsRow());
    document.getElementById("gw-ds-validate")?.addEventListener("change", (e) => {
      const on = (e.currentTarget as HTMLInputElement).checked;
      setDsVisible(on);
      if (on && document.querySelectorAll("#gw-ds-fields .gw-ds-row").length === 0) addDsRow();
    });
    document.getElementById("gw-url-copy")?.addEventListener("click", () => {
      const v = document.getElementById("gw-url-value")!.textContent || "";
      if (v) navigator.clipboard.writeText(v).then(() => showToast(t("gateway.toasts.copied", "URL copiada")));
    });

    document.getElementById("form-gateway")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("gw-error")!;
      errEl.classList.add("hidden");
      const payload = collectGatewayPayload();
      if (!payload.name) { errEl.textContent = t("gateway.dialog.nameHint", "Nombre requerido"); errEl.classList.remove("hidden"); return; }
      const res = editGatewayId
        ? await api.put<any>(`/api/webhooks/gateways/${editGatewayId}`, payload)
        : await api.post<any>("/api/webhooks/gateways", payload);
      if (res.ok) {
        (document.getElementById("dialog-gateway") as HTMLDialogElement).close();
        showToast(editGatewayId ? t("gateway.toasts.updated", "Webhook actualizado") : t("gateway.toasts.created", "Webhook creado"));
        if (!editGatewayId) revealUrl(((res.data as any)?.data ?? {}).ingestUrl ?? "");
        void loadGateways();
      } else {
        errEl.textContent = res.error ?? t("gateway.toasts.error", "Error al guardar");
        errEl.classList.remove("hidden");
      }
    });
  }

  function copyGatewayUrl(id: number) {
    const g = gatewaysById.get(id);
    if (!g?.ingestUrl) return;
    navigator.clipboard.writeText(g.ingestUrl).then(() => showToast(t("gateway.toasts.copied", "URL copiada")));
  }

  function openPayloads(id: number) {
    const g = gatewaysById.get(id);
    if (!g) return;
    const list = document.getElementById("gwp-list")!;
    const empty = document.getElementById("gwp-empty")!;
    const payloads: any[] = Array.isArray(g.recentPayloads) ? g.recentPayloads : [];
    list.innerHTML = "";
    empty.classList.toggle("hidden", payloads.length > 0);
    for (const p of payloads) {
      const body = typeof p.data === "string" ? p.data : JSON.stringify(p.data, null, 2);
      list.insertAdjacentHTML("beforeend", `<div class="rounded-lg border border-border bg-muted/20 p-3">
        <div class="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span class="rounded bg-card border border-border px-1.5 py-0.5 font-mono">${esc(p.method ?? "")}</span>
          <span>${esc(p.ip ?? "")}</span><span class="ml-auto">${esc(dt(p.receivedAt))}</span>
        </div>
        <pre class="text-xs font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">${esc(body)}</pre>
      </div>`);
    }
    openDialog("dialog-gw-payloads");
  }

  async function deleteGateway(id: number) {
    const g = gatewaysById.get(id);
    if (!await openConfirm(
      fmt(t("gateway.confirm.deleteBody", "¿Eliminar el webhook \"{name}\"?"), { name: String(g?.name ?? "") }),
      { title: t("gateway.confirm.deleteTitle", "Eliminar webhook"), confirmText: t("gateway.confirm.deleteBtn", "Sí, eliminar"), variant: "danger" },
    )) return;
    const res = await api.delete(`/api/webhooks/gateways/${id}`);
    if (res.ok) { showToast(t("gateway.toasts.deleted", "Webhook eliminado")); void loadGateways(); }
    else showToast(res.error ?? t("gateway.toasts.error", "Error"), false);
  }

  function bindPayloadsDialog() {
    document.getElementById("gwp-close")?.addEventListener("click", () => (document.getElementById("dialog-gw-payloads") as HTMLDialogElement).close());
    document.getElementById("gwp-cancel")?.addEventListener("click", () => (document.getElementById("dialog-gw-payloads") as HTMLDialogElement).close());
    document.getElementById("btn-rescan-gw")?.addEventListener("click", () => void rescanReceivers());
  }

  // ── Legacy outbound webhooks ───────────────────────────────
  let availableEvents: string[] = [];
  let editWebhookId: number | null = null;
  const outboundById = new Map<number, any>();

  async function loadEventTypes() {
    const res = await api.get<any>("/api/webhooks/events");
    availableEvents = (res.data as any)?.events ?? res.data ?? [];
    const container = document.getElementById("events-checkboxes");
    if (!container) return;
    container.innerHTML = availableEvents.map((e: string) => `
      <label class="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-accent text-xs">
        <input type="checkbox" name="wh-event" value="${esc(e)}" class="h-3.5 w-3.5 rounded border-input text-primary" />
        <span>${esc(e)}</span>
      </label>`).join("");
  }

  async function loadWebhooks() {
    const res = await webhookPages.read<any>(params => api.get<any>("/api/webhooks", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
    if (!res.ok) { publishRows(WEBHOOKS_TABLE_ID, []); return; }
    const items: any[] = (res.data as any)?.items ?? res.data ?? [];
    outboundById.clear();
    items.forEach((item) => outboundById.set(Number(item.id), item));
    const rows = items.map((w: any) => ({
      id: w.id,
      name: String(w.name ?? ""),
      url: String(w.url ?? ""),
      eventos: Array.isArray(w.events) ? w.events : [],
      estado: !w.enabled ? t("labels.statusPaused", "Pausado") : Number(w.failureCount) > 0 ? t("labels.statusFailing", "Fallando") : t("labels.statusActive", "Activo"),
      _id: w.id,
    }));
    publishRows(WEBHOOKS_TABLE_ID, rows);
  }

  function editWebhook(id: number) {
    const hook = outboundById.get(id);
    if (!hook) return;
    editWebhookId = id;
    document.getElementById("wh-dialog-title")!.textContent = t("gateway.dialog.titleEdit", "Editar webhook");
    (document.getElementById("wh-name") as HTMLInputElement).value = hook.name || "";
    (document.getElementById("wh-url") as HTMLInputElement).value = hook.url || "";
    (document.getElementById("wh-enabled") as HTMLInputElement).checked = !!hook.enabled;
    document.querySelectorAll<HTMLInputElement>("input[name='wh-event']").forEach((input) => { input.checked = hook.events?.includes(input.value) || false; });
    openDialog("dialog-webhook");
  }

  async function testWebhook(id: number) {
    const res = await api.post<any>(`/api/webhooks/${id}/test`, {});
    showToast(res.ok ? t("runtime.testDelivered", "Prueba entregada correctamente.") : (res.error || t("runtime.testFailed", "La entrega de prueba falló.")), res.ok);
    void loadHistory(id);
  }

  async function loadHistory(id: number) {
    const panel = document.getElementById("wh-history");
    const content = document.getElementById("wh-history-content");
    if (!panel || !content) return;
    panel.classList.remove("hidden");
    content.textContent = t("runtime.loadingDeliveries", "Cargando entregas…");
    const res = await api.get<Array<{ event: string; delivered: boolean; status: number | null; attempts: number; at: string }>>(`/api/webhooks/${id}/deliveries`);
    if (!res.ok) { content.textContent = res.error || t("runtime.loadDeliveriesError", "No se pudieron cargar las entregas."); return; }
    const rows = res.data || [];
    if (!rows.length) { content.textContent = t("runtime.noDeliveries", "Todavía no hay entregas registradas."); return; }
    content.replaceChildren(...rows.map((row) => {
      const item = document.createElement("div");
      item.className = "flex flex-wrap justify-between gap-2 border-b border-border py-2 last:border-0";
      item.textContent = `${new Date(row.at).toLocaleString(document.documentElement.lang || undefined)} · ${row.event} · ${row.delivered ? t("runtime.delivered", "Entregado") : t("runtime.failed", "Fallido")} · HTTP ${row.status ?? "—"} · ${fmt(t("runtime.attempts", "Intentos: {count}"), { count: row.attempts })}`;
      return item;
    }));
  }

  async function regenerateSecret(id: number) {
    if (!await openConfirm(t("confirm.rotateSecretBody", "¿Rotar el secret de este webhook? Deberás actualizar el receptor."), { title: t("confirm.rotateSecretTitle", "Rotar secret"), confirmText: t("confirm.rotateSecretBtn", "Sí, rotar") })) return;
    const res = await api.post(`/api/webhooks/${id}/regenerate-secret`);
    if (res.ok) {
      const secret = (res.data as any)?.secret;
      if (secret) {
        document.getElementById("wh-secret-value")!.textContent = secret;
        document.getElementById("wh-secret-reveal")!.classList.remove("hidden");
      }
      showToast(t("toasts.secretRotated", "Secret rotado"));
    }
    else showToast(t("toasts.errorRotating", "Error al rotar"), false);
  }

  async function deleteWebhook(id: number) {
    if (!await openConfirm(t("confirm.deleteWebhookBody", "¿Eliminar este webhook?"), { title: t("confirm.deleteWebhookTitle", "Eliminar webhook"), variant: "danger" })) return;
    const res = await api.delete(`/api/webhooks/${id}`);
    if (res.ok) { showToast(t("toasts.webhookDeleted", "Webhook eliminado")); void loadWebhooks(); }
    else showToast(t("toasts.errorDeleting", "Error al eliminar"), false);
  }

  function bindWebhookForm() {
    document.getElementById("btn-new-webhook")?.addEventListener("click", () => {
      editWebhookId = null;
      document.getElementById("wh-dialog-title")!.textContent = t("labels.newWebhookTitle", "Nuevo webhook");
      (document.getElementById("form-webhook") as HTMLFormElement).reset();
      document.querySelectorAll<HTMLInputElement>("input[name='wh-event']").forEach((input) => { input.checked = false; });
      openDialog("dialog-webhook");
    });
    document.getElementById("wh-close")?.addEventListener("click", () => (document.getElementById("dialog-webhook") as HTMLDialogElement).close());
    document.getElementById("wh-cancel")?.addEventListener("click", () => (document.getElementById("dialog-webhook") as HTMLDialogElement).close());
    document.getElementById("wh-history-close")?.addEventListener("click", () => document.getElementById("wh-history")?.classList.add("hidden"));

    document.getElementById("form-webhook")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("wh-error")!;
      errEl.classList.add("hidden");
      const url = (document.getElementById("wh-url") as HTMLInputElement).value;
      const name = (document.getElementById("wh-name") as HTMLInputElement).value.trim();
      const events = Array.from(document.querySelectorAll<HTMLInputElement>("input[name='wh-event']:checked")).map((cb) => cb.value);
      if (!events.length) { errEl.textContent = t("runtime.selectEvent", "Selecciona al menos un evento."); errEl.classList.remove("hidden"); return; }
      const enabled = (document.getElementById("wh-enabled") as HTMLInputElement).checked;
      const res = editWebhookId
        ? await api.put(`/api/webhooks/${editWebhookId}`, { name, url, events, enabled })
        : await api.post<any>("/api/webhooks", { name, url, events, enabled });
      if (res.ok) {
        const secret = (res.data as any)?.secret;
        if (secret) {
          document.getElementById("wh-secret-value")!.textContent = secret;
          document.getElementById("wh-secret-reveal")!.classList.remove("hidden");
        }
        (document.getElementById("dialog-webhook") as HTMLDialogElement).close();
        showToast(editWebhookId ? t("toasts.webhookUpdated", "Webhook actualizado") : t("toasts.webhookCreated", "Webhook creado"));
        void loadWebhooks();
      } else {
        errEl.textContent = res.error ?? t("toasts.errorSaving", "Error al guardar");
        errEl.classList.remove("hidden");
      }
    });
  }

  // ── API Keys ───────────────────────────────────────────────
  async function loadKeys() {
    const res = await keyPages.read<any>(params => api.get<any>("/api/api-keys", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
    if (!res.ok) { publishRows(APIKEYS_TABLE_ID, []); return; }
    const items: any[] = (res.data as any)?.items ?? res.data ?? [];
    const rows = items.map((k: any) => ({
      id: k.id,
      name: String(k.name ?? ""),
      prefix: k.prefix ?? "lxp_...",
      creada: k.createdAt ? new Date(k.createdAt).toLocaleDateString(document.documentElement.lang || undefined) : "—",
      expira: k.expiresAt ? new Date(k.expiresAt).toLocaleDateString(document.documentElement.lang || undefined) : t("labels.noExpiry", "Sin expiración"),
      _name: String(k.name ?? ""),
    }));
    publishRows(APIKEYS_TABLE_ID, rows);
  }

  async function revokeKey(id: number, name: string) {
    if (!await openConfirm(fmt(t("confirm.revokeKeyBody", "¿Revocar la API key \"{name}\"?"), { name }), { title: t("confirm.revokeKeyTitle", "Revocar API key"), confirmText: t("confirm.revokeKeyBtn", "Sí, revocar"), variant: "danger" })) return;
    const res = await api.delete(`/api/api-keys/${id}`);
    if (res.ok) { showToast(t("toasts.keyRevoked", "Key revocada")); void loadKeys(); }
    else showToast(t("toasts.errorRevoking", "Error al revocar"), false);
  }

  function bindKeyForm() {
    document.getElementById("btn-new-key")?.addEventListener("click", () => openDialog("dialog-key"));
    document.getElementById("key-close")?.addEventListener("click", () => (document.getElementById("dialog-key") as HTMLDialogElement).close());
    document.getElementById("key-cancel")?.addEventListener("click", () => (document.getElementById("dialog-key") as HTMLDialogElement).close());

    document.getElementById("form-key")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = (document.getElementById("key-name") as HTMLInputElement).value;
      const expiresAt = (document.getElementById("key-expires") as HTMLInputElement).value || null;
      const res = await api.post<any>("/api/api-keys", { name, expiresAt });
      if (res.ok) {
        (document.getElementById("dialog-key") as HTMLDialogElement).close();
        const key = (res.data as any)?.key ?? (res.data as any)?.plaintext;
        if (key) {
          const reveal = document.getElementById("new-key-reveal")!;
          document.getElementById("new-key-value")!.textContent = key;
          reveal.classList.remove("hidden");
          document.getElementById("btn-copy-key")!.addEventListener("click", () => {
            navigator.clipboard.writeText(key).then(() => showToast(t("toasts.copiedToClipboard", "Copiado al portapapeles")));
          }, { once: true });
        }
        void loadKeys();
      } else showToast(t("toasts.errorCreatingKey", "Error al crear la key"), false);
    });
  }

  // ── Detectados (discovered) ────────────────────────────────
  let discoveredItems: any[] = [];

  function localizedSource(s: string): string {
    const fallbacks: Record<string, string> = {
      sidecar: "Panel", "git-hook": "Git hook", nginx: "Nginx", cron: "Cron", systemd: "systemd", config: "Config", project: "Proyecto",
    };
    return t("discovered.sources." + s, fallbacks[s] ?? s);
  }

  function discoveredEstado(enabled: boolean | null): string {
    if (enabled === true) return t("discovered.status.enabled", "Activo");
    if (enabled === false) return t("discovered.status.disabled", "Inactivo");
    return t("discovered.status.unknown", "—");
  }

  function toDiscoveredRow(it: any) {
    return {
      origen: localizedSource(it.source),
      name: String(it.name ?? ""),
      target: String(it.target ?? ""),
      location: String(it.location ?? ""),
      estado: discoveredEstado(it.enabled),
      _id: it.id,
    };
  }

  function renderDiscovered(items: any[]) {
    discoveredItems = Array.isArray(items) ? items : [];
    publishRows(DISCOVERED_TABLE_ID, discoveredItems.map(toDiscoveredRow));
    // Receive-data receivers feed the gateway tab's "detected" table.
    
  }

  async function loadDiscovered() {
    const res = await discoveredPages.read<any>(params => api.get<any>("/api/webhooks/discovered", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
    if (!res.ok) { renderDiscovered([]); return; }
    const items: any[] = (res.data as any)?.data ?? (res.data as any)?.items ?? res.data ?? [];
    renderDiscovered(items);
  }

  const detectedPages = createTablePages({tableId:GW_DETECTED_TABLE_ID,events:window,scope:resolveTargetScope,reload:()=>loadDetectedReceivers(),field:"auto",aliases:{origen:"source",estado:"enabled"},values:()=>({origen:Object.fromEntries(["sidecar","git-hook","nginx","cron","systemd","config","project"].map(source=>[localizedSource(source),source])),estado:{[discoveredEstado(true)]:"true",[discoveredEstado(false)]:"false"}})});
  let detectedItems: any[] = [];
  // Each view owns its query and page window.
  async function loadDetectedReceivers() {
    const res = await detectedPages.read<any>(params => {const query=JSON.parse(params.tableWindow!);query.filters.push({key:"category",type:"select",value:"receive-data"});return api.get<any>("/api/webhooks/discovered", {params:{...params,tableWindow:JSON.stringify(query)}});});
  if (res.code === "TARGET_SCOPE_CHANGED") return;
    if (res.ok) { detectedItems = (res.data as any)?.data ?? (res.data as any)?.items ?? res.data ?? []; publishRows(GW_DETECTED_TABLE_ID, detectedItems.map(toDiscoveredRow)); }
  }

  async function rescanDiscovered() {
    const btn = document.getElementById("btn-rescan-discovered") as HTMLButtonElement | null;
    const original = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = `<i class="ti ti-loader text-base"></i>${t("discovered.scanning", "Escaneando…")}`; }
    try {
      const res = await api.post<any>("/api/webhooks/discovered/scan");
      if (res.ok) {
        const items: any[] = (res.data as any)?.data ?? (res.data as any)?.items ?? res.data ?? [];
        renderDiscovered(items);
        showToast(fmt(t("discovered.toasts.scanComplete", "Escaneo completado: {count}"), { count: items.length }));
      } else showToast(res.error ?? t("discovered.toasts.notManageable", "No se pudo escanear"), false);
    } finally {
      if (btn && original !== undefined) { btn.disabled = false; btn.innerHTML = original; }
    }
  }

  async function rescanReceivers() {
    const btn = document.getElementById("btn-rescan-gw") as HTMLButtonElement | null;
    const original = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = `<i class="ti ti-loader text-sm"></i>${t("discovered.scanning", "Escaneando…")}`; }
    try { await rescanDiscovered(); await loadDetectedReceivers(); } finally {
      if (btn && original !== undefined) { btn.disabled = false; btn.innerHTML = original; }
    }
  }

  function openDiscoveredDetail(id: string) {
    const it = [...discoveredItems,...detectedItems].find((x: any) => String(x.id) === String(id));
    if (!it) return;
    document.getElementById("disc-source")!.textContent = localizedSource(it.source);
    document.getElementById("disc-target")!.textContent = String(it.target ?? "");
    document.getElementById("disc-location")!.textContent = String(it.location ?? "");
    document.getElementById("disc-info")!.textContent = String(it.detail ?? "—");
    document.getElementById("disc-raw")!.textContent = String(it.raw ?? "—");
    const note = document.getElementById("disc-note")!;
    note.textContent = it.managed
      ? t("discovered.detail.managedNote", "Este webhook es gestionado por el panel.")
      : t("discovered.detail.readonlyNote", "Origen de solo lectura; no puede modificarse desde el panel.");
    note.classList.remove("hidden");
    openDialog("dialog-discovered");
  }

  async function deleteDiscovered(id: string) {
    const it = [...discoveredItems,...detectedItems].find((x: any) => String(x.id) === String(id));
    if (!it) return;
    if (!await openConfirm(
      fmt(t("discovered.confirm.deleteBody", "¿Eliminar el webhook detectado \"{name}\"?"), { name: String(it.name ?? "") }),
      { title: t("discovered.confirm.deleteTitle", "Eliminar detectado"), confirmText: t("discovered.confirm.deleteBtn", "Sí, eliminar"), variant: "danger" },
    )) return;
    const res = await api.post<any>("/api/webhooks/discovered/action", { id: String(id), op: "delete" });
    if (res.ok) { showToast(t("discovered.toasts.deleted", "Webhook eliminado")); void loadDiscovered(); }
    else showToast(res.error ?? t("discovered.toasts.errorDeleting", "Error al eliminar"), false);
  }

  function bindDiscovered() {
    document.getElementById("btn-rescan-discovered")?.addEventListener("click", () => void rescanDiscovered());
    document.getElementById("disc-close")?.addEventListener("click", () => (document.getElementById("dialog-discovered") as HTMLDialogElement).close());
    document.getElementById("disc-cancel")?.addEventListener("click", () => (document.getElementById("dialog-discovered") as HTMLDialogElement).close());
  }

  // ── DataTable events ───────────────────────────────────────
  let tableEventsBound = false;
  function bindTableEvents() {
    if (tableEventsBound) return;
    tableEventsBound = true;

    feed.bindReady();

    window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
      const detail = (event as CustomEvent<any>).detail;
      const row = detail?.row;
      if (!row) return;
      switch (detail.tableId) {
        case GATEWAY_TABLE_ID:
          if (detail.actionId === "copy") copyGatewayUrl(Number(row._id));
          else if (detail.actionId === "payloads") openPayloads(Number(row._id));
          else if (detail.actionId === "edit") { const g = gatewaysById.get(Number(row._id)); if (g) openGatewayDialog(g); }
          else if (detail.actionId === "delete") void deleteGateway(Number(row._id));
          return;
        case GW_DETECTED_TABLE_ID:
          if (detail.actionId === "detail") openDiscoveredDetail(String(row._id));
          return;
        case WEBHOOKS_TABLE_ID:
          if (detail.actionId === "edit") editWebhook(Number(row._id));
          else if (detail.actionId === "test") void testWebhook(Number(row._id));
          else if (detail.actionId === "history") void loadHistory(Number(row._id));
          else if (detail.actionId === "regenerate") void regenerateSecret(Number(row._id));
          else if (detail.actionId === "delete") void deleteWebhook(Number(row._id));
          return;
        case APIKEYS_TABLE_ID:
          if (detail.actionId === "revoke") void revokeKey(Number(row.id), String(row._name));
          return;
        case DISCOVERED_TABLE_ID:
          if (detail.actionId === "detail") openDiscoveredDetail(String(row._id));
          else if (detail.actionId === "delete") void deleteDiscovered(String(row._id));
          return;
      }
    });
  }

  let initLastAt = 0;
  const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
  let lastBoundRoot: Element | null = null;
  function init() {
    loadI18n();
    const root = document.getElementById("tab-receive");
    if (!root) return;
    if (root !== lastBoundRoot) {
      lastBoundRoot = root;
    watchModuleData(["webhooks/webhooks"], () => loadWebhooks(), root);
      bindTabs();
      bindGatewayForm();
      bindPayloadsDialog();
      bindWebhookForm();
      bindKeyForm();
      bindDiscovered();
      bindTableEvents();
    }
    if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
    initLastAt = Date.now();
    feed.requestReady();
    const drawerView = new URLSearchParams(location.search).get("workspaceView");
    if (!drawerView || drawerView === "receive") { void loadGateways(); void loadDetectedReceivers(); }
    if (!drawerView || drawerView === "webhooks") { void loadWebhooks(); void loadEventTypes(); }
    if (drawerView === "keys") void loadKeys();
    if (drawerView === "discovered") void loadDiscovered();
  }
  document.addEventListener("astro:page-load", init);
  document.addEventListener("astro:after-swap", init);
  init();
