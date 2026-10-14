  import {
    api,
    resolvePanelApiPath,
    BRIDGE_SESSION_SESSION_KEY,
    SERVER_SWITCHER_ID,
    ATTR_CURRENT_BRIDGE_SESSION_ID,
    SESSION_COOKIE_NAME,
  } from "/scripts/extracted/lib/api-client.js?v=20260506a";
  import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
  import { escapeHtml } from "/scripts/extracted/lib/escape.js";
  import { openDialog } from "/scripts/extracted/lib/dom.js";
  import { TOAST_LEGACY_MS, showToast as showSharedToast } from "/scripts/extracted/lib/toast.js";
  import { WS_TOKEN_PATH } from "/scripts/extracted/lib/api-routes.js";
  import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";

  const { loadI18n, t, fmt } = createPageI18n("monitor-i18n");

  function showToast(msg: string, ok = true) {
    showSharedToast(msg, ok, { durationMs: TOAST_LEGACY_MS });
  }

  // ── Helpers ────────────────────────────────────────────────
  function fmtBytes(bps: number): string {
    if (bps > 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
    if (bps > 1_000) return `${(bps / 1_000).toFixed(1)} KB/s`;
    return `${Math.round(bps)} B/s`;
  }

  function setBar(id: string, pct: number) {
    const bar = document.getElementById(id);
    if (!bar) return;
    bar.style.width = `${Math.min(pct, 100)}%`;
    // Color by percentage
    bar.className = `h-full rounded-full transition-all duration-500 ${
      pct > 90 ? "bg-destructive" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"
    }`;
  }

  function updateStats(snap: any) {
    // Guard: bail if DOM elements no longer exist (user navigated away)
    if (document.hidden || !document.getElementById("stat-cpu")) return;

    // CPU — backend field: cpu.usagePercent
    const cpuPct = snap.cpu?.usagePercent ?? 0;
    const statCpu = document.getElementById("stat-cpu");
    const loadAvg = document.getElementById("load-avg");
    const statMem = document.getElementById("stat-mem");
    const memDetail = document.getElementById("mem-detail");
    const statDisk = document.getElementById("stat-disk");
    const diskDetail = document.getElementById("disk-detail");
    const statRx = document.getElementById("stat-rx");
    const statTx = document.getElementById("stat-tx");
    if (!statCpu || !loadAvg || !statMem || !memDetail || !statDisk || !diskDetail || !statRx || !statTx) return;
    statCpu.textContent = cpuPct.toFixed(1);
    setBar("bar-cpu", cpuPct);
    const la = snap.cpu;
    loadAvg.textContent = la
      ? `${la.loadAvg1m?.toFixed(2)} / ${la.loadAvg5m?.toFixed(2)} / ${la.loadAvg15m?.toFixed(2)}`
      : "—";

    // Memory — backend fields: usedBytes / totalBytes
    const memPct = snap.memory?.usagePercent ?? 0;
    statMem.textContent = memPct.toFixed(1);
    setBar("bar-mem", memPct);
    const usedMb = snap.memory ? Math.round(snap.memory.usedBytes / 1_048_576) : null;
    const totalMb = snap.memory ? Math.round(snap.memory.totalBytes / 1_048_576) : null;
    memDetail.textContent =
      usedMb != null ? `${usedMb} / ${totalMb} MB` : "— / — MB";

    // Disk — backend fields: usedBytes / totalBytes
    const diskPct = snap.disk?.usagePercent ?? 0;
    statDisk.textContent = diskPct.toFixed(1);
    setBar("bar-disk", diskPct);
    const usedGb = snap.disk ? (snap.disk.usedBytes / 1_073_741_824).toFixed(1) : null;
    const totalGb = snap.disk ? (snap.disk.totalBytes / 1_073_741_824).toFixed(1) : null;
    diskDetail.textContent =
      usedGb != null ? `${usedGb} / ${totalGb} GB` : "— / — GB";

    // Network
    statRx.textContent = fmtBytes(snap.network?.rxBytesPerSec ?? 0);
    statTx.textContent = fmtBytes(snap.network?.txBytesPerSec ?? 0);
  }

  // ── WebSocket live stream ──────────────────────────────────
  let _ws: WebSocket | null = null;
  let _wsRetry: ReturnType<typeof setTimeout> | null = null;
  let _wsAlive = false; // tracks whether WS has received at least one stats event
  let _wsTokenCache: { token: string; expiresAt: number } | null = null;

  function setWsStatus(html: string) {
    const el = document.getElementById("sse-status");
    if (el) el.innerHTML = html;
  }

  function getCookieToken(): string {
    return document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.split("=")[1] ?? "";
  }

  async function getWebsocketToken(): Promise<string> {
    const cookieToken = getCookieToken();
    if (cookieToken) return cookieToken;
    if (_wsTokenCache && _wsTokenCache.expiresAt - Date.now() > 15_000) {
      return _wsTokenCache.token;
    }

    const res = await fetch(resolvePanelApiPath(WS_TOKEN_PATH), {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).catch(() => null);
    if (!res) return "";
    if (!res.ok) return "";

    const json = await res.json().catch(() => null) as { data?: { token?: string; expiresAt?: number } } | null;
    const token = typeof json?.data?.token === "string" ? json.data.token : "";
    const expiresAt = typeof json?.data?.expiresAt === "number" ? json.data.expiresAt : 0;
    if (token && expiresAt > Date.now()) {
      _wsTokenCache = { token, expiresAt };
    }
    return token;
  }

  async function buildWsUrl(): Promise<string> {
    // Standalone: same-origin WS, no LP gateway. See `lib/assistant-ws.ts`.
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const qs = new URLSearchParams();
    // Prefers the session cookie, falls back to /api/auth/ws-token.
    const token = await getWebsocketToken();
    if (token) qs.set("token", token);
    // Aislamiento de sesión por pestaña: el backend resuelve el target del WS
    // desde este id (query "bridge") en vez de la cookie compartida por host.
    let tabBridge = "";
    try { tabBridge = (sessionStorage.getItem(BRIDGE_SESSION_SESSION_KEY) || "").trim(); } catch { /* ignore */ }
    if (!tabBridge) {
      tabBridge = (document.getElementById(SERVER_SWITCHER_ID)?.getAttribute(ATTR_CURRENT_BRIDGE_SESSION_ID) || "").trim();
    }
    if (tabBridge) qs.set("bridge", tabBridge);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";

    return `${proto}//${window.location.host}/api/monitor/ws${suffix}`;
  }

  async function connectWS() {
    if (document.hidden) return;
    if (_ws && _ws.readyState <= WebSocket.OPEN) return; // already connecting/open

    const url = await buildWsUrl();
    if (document.hidden) return;
    const ws = new WebSocket(url);
    _ws = ws;

    ws.onopen = () => {
      setWsStatus(`<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ${t("labels.connecting", "Conectando...")}`);
    };

    ws.onmessage = (event) => {
      let msg: { type: string; data?: any };
      try { msg = JSON.parse(event.data); } catch { return; }

      switch (msg.type) {
        case "connected":
          setWsStatus(`<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> ${t("labels.live", "En vivo")}`);
          break;
        case "stats":
          _wsAlive = true;
          updateStats(msg.data);
          break;
        case "alert:firing":
          showToast(fmt(t("toasts.alertFiring", "⚠ Alerta: {name}"), { name: msg.data?.name ?? "" }), false);
          break;
        case "pong":
          break;
      }
    };

    ws.onclose = () => {
      if (_ws !== ws) return; // replaced
      _ws = null;
      _wsAlive = false;
      if (!document.getElementById("sse-status")) return; // navigated away
      setWsStatus(`<span class="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse"></span> ${t("labels.reconnecting", "Reconectando...")}`);
      if (_wsRetry) clearTimeout(_wsRetry);
      _wsRetry = setTimeout(connectWS, 5000);
    };

    ws.onerror = () => {
      // onclose fires right after, let it handle retry
    };
  }

  // ── Services ───────────────────────────────────────────────
  async function loadServices() {
    const res = await api.get<any>("/api/monitor/services");
    if (!res.ok) return;
    const services: any[] = (res.data as any)?.services ?? res.data ?? [];
    const el = document.getElementById("services-list");
    if (!el) return;
    el.innerHTML = services.map((s: any) => `
      <div class="flex items-center justify-between px-4 py-2.5">
        <span class="text-sm font-medium">${escapeHtml(s.name)}</span>
        <span class="inline-flex items-center gap-1.5 text-xs font-medium ${s.active ? "text-emerald-500" : "text-destructive"}">
          <span class="h-1.5 w-1.5 rounded-full ${s.active ? "bg-emerald-500" : "bg-destructive"}"></span>
          ${s.active ? t("labels.serviceActive", "Activo") : t("labels.serviceInactive", "Inactivo")}
          ${s.uptime ? `<span class="text-muted-foreground">· ${escapeHtml(s.uptime)}</span>` : ""}
        </span>
      </div>
    `).join("");
  }

  // ── Alerts ────────────────────────────────────────────────
  async function loadAlerts() {
    const res = await api.get<any>("/api/monitor/alerts/rules");
    if (!res.ok) return;
    const alerts: any[] = (res.data as any)?.items ?? res.data ?? [];
    const el = document.getElementById("alerts-list");
    if (!el) return;

    if (alerts.length === 0) {
      el.innerHTML = `<div class="px-4 py-5 text-center text-sm text-muted-foreground"><i class="ti ti-bell-off text-2xl block mb-1.5 mx-auto opacity-40"></i>${t("empty.noRules", "Sin reglas configuradas")}</div>`;
      return;
    }

    el.innerHTML = alerts.map((a: any) => `
      <div class="flex items-center justify-between px-4 py-2.5">
        <div>
          <p class="text-sm font-medium">${escapeHtml(a.name)}</p>
          <p class="text-xs text-muted-foreground">${escapeHtml(a.metric)} ${escapeHtml(a.operator)} ${escapeHtml(a.threshold)}</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            a.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
          }">
            ${a.enabled ? t("labels.alertActive", "Activa") : t("labels.alertPaused", "Pausada")}
          </span>
          <button onclick="deleteAlert(${a.id})" class="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <i class="ti ti-trash text-sm"></i>
          </button>
        </div>
      </div>
    `).join("");
  }

  (window as any).deleteAlert = async (id: number) => {
    const res = await api.delete(`/api/monitor/alerts/rules/${id}`);
    if (res.ok) { showToast(t("toasts.ruleDeleted", "Regla eliminada")); loadAlerts(); }
    else showToast(t("errors.deleteRule", "Error al eliminar"), false);
  };

  document.getElementById("btn-new-alert")?.addEventListener("click", () => {
    openDialog("dialog-alert");
  });
  document.getElementById("alert-close")?.addEventListener("click", () => {
    (document.getElementById("dialog-alert") as HTMLDialogElement).close();
  });
  document.getElementById("alert-cancel")?.addEventListener("click", () => {
    (document.getElementById("dialog-alert") as HTMLDialogElement).close();
  });

  document.getElementById("form-alert")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("alert-error")!;
    errEl.classList.add("hidden");
    const name = (document.getElementById("alert-name") as HTMLInputElement).value;
    const metric = (document.getElementById("alert-metric") as HTMLSelectElement).value;
    const operator = (document.getElementById("alert-op") as HTMLSelectElement).value;
    const threshold = Number((document.getElementById("alert-threshold") as HTMLInputElement).value);
    const sustainedSamples = Number((document.getElementById("alert-sustained") as HTMLInputElement).value);

    const res = await api.post("/api/monitor/alerts/rules", { name, metric, operator, threshold, sustainedSamples });
    if (res.ok) {
      (document.getElementById("dialog-alert") as HTMLDialogElement).close();
      showToast(t("toasts.ruleCreated", "Regla creada"));
      loadAlerts();
    } else {
      errEl.textContent = res.error ?? t("errors.createRule", "Error al crear la regla");
      errEl.classList.remove("hidden");
    }
  });

  // ── Processes ─────────────────────────────────────────────
  let procSortBy: "cpu" | "mem" = "cpu";
  let procRefreshTimer: ReturnType<typeof setInterval> | null = null;

  function fmtMem(kb: number): string {
    if (kb >= 1_048_576) return `${(kb / 1_048_576).toFixed(1)} GB`;
    if (kb >= 1_024) return `${(kb / 1_024).toFixed(0)} MB`;
    return `${kb} KB`;
  }

  async function loadProcesses() {
    const res = await api.get<any>("/api/monitor/processes", { params: { sortBy: procSortBy, limit: "20" } });
    const tbody = document.getElementById("proc-tbody")!;
    const updatedEl = document.getElementById("proc-updated")!;

    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-sm text-muted-foreground">${t("errors.loadProcesses", "Error al cargar procesos")}</td></tr>`;
      return;
    }

    const procs: any[] = (res.data as any)?.processes ?? (res.data as any)?.items ?? res.data ?? [];

    if (procs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-sm text-muted-foreground">${t("empty.noProcesses", "Sin datos de procesos")}</td></tr>`;
      return;
    }

    tbody.innerHTML = procs.map((p: any, i: number) => {
      const cpuPct = p.cpuPercent ?? p.cpu ?? 0;
      const memPct = p.memPercent ?? p.memoryPercent ?? 0;
      const memKb = p.memKb ?? p.rssKb ?? 0;
      const cpuColor = cpuPct > 50 ? "text-destructive" : cpuPct > 20 ? "text-amber-500" : "text-foreground";
      const memColor = memPct > 50 ? "text-destructive" : memPct > 20 ? "text-amber-500" : "text-foreground";

      return `
        <tr class="border-b border-border/50 hover:bg-muted/20 transition-colors">
          <td class="px-4 py-2 text-xs text-muted-foreground font-mono">${p.pid ?? "—"}</td>
          <td class="px-4 py-2 max-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono font-medium truncate" title="${escapeHtml(p.command ?? p.name ?? "")}">${escapeHtml(p.name ?? p.command ?? "—")}</span>
              ${i === 0 ? `<span class="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">#1</span>` : ""}
            </div>
            ${p.command && p.command !== p.name ? `<p class="text-[10px] text-muted-foreground truncate font-mono mt-0.5" title="${escapeHtml(p.command)}">${escapeHtml(p.command.substring(0, 60))}${p.command.length > 60 ? "…" : ""}</p>` : ""}
          </td>
          <td class="px-4 py-2 text-xs text-muted-foreground">${escapeHtml(p.user ?? "—")}</td>
          <td class="px-4 py-2 text-right">
            <span class="text-xs font-mono font-medium ${cpuColor}">${cpuPct.toFixed(1)}</span>
          </td>
          <td class="px-4 py-2 text-right text-xs font-mono text-muted-foreground">${memKb ? fmtMem(memKb) : "—"}</td>
          <td class="px-4 py-2 text-right">
            <span class="text-xs font-mono font-medium ${memColor}">${memPct.toFixed(1)}</span>
          </td>
        </tr>`;
    }).join("");

    updatedEl.textContent = fmt(t("labels.updatedAt", "Actualizado {time}"), {
      time: new Date().toLocaleTimeString(document.documentElement.lang || undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    });
  }

  function setProcSort(sort: "cpu" | "mem") {
    procSortBy = sort;
    const cpuBtn = document.getElementById("proc-sort-cpu");
    const memBtn = document.getElementById("proc-sort-mem");
    if (!cpuBtn || !memBtn) return;
    if (sort === "cpu") {
      cpuBtn.className = "rounded-md px-3 py-1 transition-colors bg-primary text-primary-foreground";
      memBtn.className = "rounded-md px-3 py-1 transition-colors text-muted-foreground hover:bg-accent";
    } else {
      memBtn.className = "rounded-md px-3 py-1 transition-colors bg-primary text-primary-foreground";
      cpuBtn.className = "rounded-md px-3 py-1 transition-colors text-muted-foreground hover:bg-accent";
    }
    if (new URLSearchParams(location.search).get("workspaceView") !== "history") loadProcesses();
    document.getElementById("monitor-tab-processes")?.addEventListener("click", () => void loadProcesses(), { once: true });
  }

  document.getElementById("proc-sort-cpu")?.addEventListener("click", () => setProcSort("cpu"));
  document.getElementById("proc-sort-mem")?.addEventListener("click", () => setProcSort("mem"));
  document.getElementById("btn-refresh-procs")?.addEventListener("click", () => {
    const btn = document.getElementById("btn-refresh-procs");
    const icon = btn?.querySelector("i");
    if (icon) icon.className = "ti ti-loader-2 animate-spin text-sm";
    loadProcesses().finally(() => {
      if (icon) icon.className = "ti ti-refresh text-sm";
    });
  });

  // ── Push Notifications ────────────────────────────────────
  const pushBtn = document.getElementById("btn-push-subscribe") as HTMLButtonElement | null;
  const pushLabel = document.getElementById("push-label");

  async function updatePushUI() {
    if (!pushBtn || !pushLabel) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      pushBtn.classList.add("hidden");
      return;
    }
    const perm = Notification.permission;
    if (perm === "granted") {
      // Check if already subscribed
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        pushLabel.textContent = t("labels.pushActive", "Push activo");
        const icon = pushBtn.querySelector("i");
        if (icon) icon.className = "ti ti-bell-ringing text-sm text-emerald-500";
        return;
      }
    }
    if (perm === "denied") {
      pushLabel.textContent = t("labels.pushBlocked", "Push bloqueado");
      pushBtn.disabled = true;
      return;
    }
    pushLabel.textContent = t("labels.notifications", "Notificaciones");
    const icon = pushBtn.querySelector("i");
    if (icon) icon.className = "ti ti-bell text-sm";
  }

  async function subscribePush() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        showToast(t("errors.pushPermissionDenied", "Permiso de notificaciones denegado"), false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;

      // Get VAPID public key from backend
      const keyRes = await api.get<any>("/api/monitor/push/vapid-public-key");
      if (!keyRes.ok) {
        showToast(t("errors.vapidNotConfigured", "El servidor no tiene VAPID configurado"), false);
        return;
      }

      const vapidKey = (keyRes.data as any)?.publicKey ?? (keyRes.data as string);
      // Convert base64url → Uint8Array
      const keyBytes = Uint8Array.from(
        atob(vapidKey.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0)
      );

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes,
      });

      // Send subscription to backend
      const saveRes = await api.post("/api/monitor/push/subscribe", sub.toJSON());
      if (saveRes.ok) {
        showToast(t("toasts.pushActivated", "Notificaciones push activadas"));
        updatePushUI();
      } else {
        showToast(t("errors.pushSubscribe", "Error al registrar suscripción"), false);
        await sub.unsubscribe();
      }
    } catch (err: any) {
      showToast(fmt(t("errors.generic", "Error: {message}"), { message: err.message }), false);
    }
  }

  async function unsubscribePush() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await api.post("/api/monitor/push/unsubscribe", { endpoint: sub.endpoint });
    await sub.unsubscribe();
    showToast(t("toasts.pushDeactivated", "Notificaciones desactivadas"));
    updatePushUI();
  }

  if (pushBtn) {
    pushBtn.addEventListener("click", async () => {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription().catch(() => null);
      if (sub) {
        if (await openConfirm(t("confirm.disablePushBody", "¿Desactivar notificaciones push?"), { title: t("confirm.disablePushTitle", "Notificaciones push"), confirmText: t("confirm.disablePushOk", "Sí, desactivar") })) await unsubscribePush();
      } else {
        await subscribePush();
      }
    });
  }

  // ── HTTP polling fallback ─────────────────────────────────
  // Runs immediately on page load and every 10s.
  // When WS is connected and delivering data (_wsAlive), the poll is skipped
  // to avoid redundant requests.
  let _pollTimer: ReturnType<typeof setInterval> | null = null;
  let monitorStarted = false;

  async function pollSnapshot() {
    if (!document.getElementById("stat-cpu")) return; // navigated away
    if (_wsAlive) return; // WS is delivering data — skip HTTP poll
    const res = await api.get<any>("/api/monitor/snapshot");
    if (res.ok && res.data) updateStats(res.data);
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    if (!document.getElementById("proc-tbody")) return; // guard: only run on this page
    if (monitorStarted) return;
    monitorStarted = true;
    loadI18n();

    // Populate KPIs immediately via HTTP then try WS
    pollSnapshot();
    connectWS();

    loadServices();
    loadAlerts();
    loadProcesses();
    updatePushUI();

    const t1 = setInterval(loadServices, 30_000);
    procRefreshTimer = setInterval(() => {
      if (!document.getElementById("monitor-panel-processes")?.classList.contains("hidden")) void loadProcesses();
    }, 15_000);
    _pollTimer = setInterval(pollSnapshot, 5_000);

    document.addEventListener("astro:before-swap", () => {
      monitorStarted = false;
      clearInterval(t1);
      if (procRefreshTimer) clearInterval(procRefreshTimer);
      if (_pollTimer) clearInterval(_pollTimer);
      if (_wsRetry) clearTimeout(_wsRetry);
      if (_ws) { _ws.close(); _ws = null; }
    }, { once: true });
  }

  document.addEventListener("lxp:module:visibility", () => {
    if (document.hidden) {
      if (_wsRetry) clearTimeout(_wsRetry);
      _wsAlive = false;
      const old = _ws; _ws = null; old?.close();
    } else { void pollSnapshot(); void connectWS(); }
  });
  document.addEventListener("astro:page-load", init);
  document.addEventListener("astro:after-swap", init);
  init();
