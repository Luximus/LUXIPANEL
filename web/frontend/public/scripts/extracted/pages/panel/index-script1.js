import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";

let dashboardStarted = false;
let pollers = [];

function isDashboardPage() {
  const path = window.location.pathname;
  return (path === "/panel" || path === "/panel/") && !!document.getElementById("activity-list");
}

function fmtBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

/**
 * Thresholds taken from common ops practice: under 60% is room to grow,
 * 60–80% is "watch it", over 80% means the box is close to running out of
 * a critical resource. Disk gets a more aggressive cap (85/95) since IO
 * stalls when the filesystem fills up.
 */
const THRESHOLDS = {
  cpu: { warn: 70, crit: 88 },
  mem: { warn: 75, crit: 90 },
  disk: { warn: 80, crit: 92 },
};

const TONE = {
  ok: {
    color: "emerald",
    bar: "bg-emerald-500",
    text: "text-emerald-500",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    label: "Estado óptimo",
    icon: "ti-circle-check",
  },
  warn: {
    color: "amber",
    bar: "bg-amber-500",
    text: "text-amber-500",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    label: "Al límite",
    icon: "ti-alert-triangle",
  },
  crit: {
    color: "red",
    bar: "bg-red-500",
    text: "text-red-500",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    label: "Crítico",
    icon: "ti-alert-octagon",
  },
};

function toneFor(metric, value) {
  const t = THRESHOLDS[metric];
  if (!t || !Number.isFinite(value)) return "ok";
  if (value >= t.crit) return "crit";
  if (value >= t.warn) return "warn";
  return "ok";
}

function applyKpiTone(kpiEl, tone, message) {
  if (!kpiEl) return;
  for (const klass of ["border-emerald-500/30", "border-amber-500/30", "border-red-500/30"]) {
    kpiEl.classList.remove(klass);
  }
  kpiEl.classList.add(TONE[tone].border);
  const msg = kpiEl.querySelector("[id$='-message']");
  if (msg) {
    msg.textContent = message || TONE[tone].label;
    msg.className = `mt-2 text-xs ${TONE[tone].text}`;
  }
  const bar = kpiEl.querySelector("[id$='-bar']");
  if (bar) {
    bar.classList.remove("bg-emerald-500", "bg-amber-500", "bg-red-500", "bg-sky-500", "bg-purple-500");
    bar.classList.add(TONE[tone].bar);
  }
}

/**
 * Pick the most severe state across CPU/RAM/Disk and surface a single
 * banner so admins don't have to mentally OR three KPI cards.
 */
function updateGlobalHealth(states) {
  const order = ["ok", "warn", "crit"];
  let worst = "ok";
  for (const s of states) {
    if (order.indexOf(s) > order.indexOf(worst)) worst = s;
  }
  const pill = document.getElementById("server-health");
  const label = document.getElementById("server-health-label");
  if (pill && label) {
    pill.dataset.state = worst;
    label.textContent = TONE[worst].label;
    pill.className = `hidden sm:flex items-center gap-2 rounded-full border ${TONE[worst].border} ${TONE[worst].bg} px-3 py-1.5 text-xs font-medium ${TONE[worst].text}`;
    const dot = pill.querySelector("span.rounded-full");
    if (dot) {
      dot.className = `h-2 w-2 rounded-full ${TONE[worst].bar} ${worst === "ok" ? "animate-pulse" : ""}`;
    }
  }

  const banner = document.getElementById("health-banner");
  const bannerIcon = document.getElementById("health-banner-icon");
  const bannerTitle = document.getElementById("health-banner-title");
  const bannerMessage = document.getElementById("health-banner-message");
  if (banner && bannerTitle && bannerMessage && bannerIcon) {
    if (worst === "ok") {
      banner.classList.add("hidden");
    } else {
      banner.classList.remove("hidden");
      banner.className = `mb-6 rounded-xl border px-4 py-3 text-sm ${TONE[worst].border} ${TONE[worst].bg} ${TONE[worst].text}`;
      bannerIcon.className = `ti ${TONE[worst].icon} text-lg shrink-0 mt-0.5`;
      if (worst === "warn") {
        bannerTitle.textContent = "Servidor al límite";
        bannerMessage.textContent = "Uno o más recursos están cerca de su capacidad. Considera revisar procesos y liberar espacio antes de que el rendimiento se vea afectado.";
      } else {
        bannerTitle.textContent = "Estado crítico";
        bannerMessage.textContent = "Un recurso está a punto de agotarse. Es muy probable que el servidor quede sin respuesta si no se actúa de inmediato.";
      }
    }
  }
}

function renderStats(stats) {
  // CPU
  const cpuEl = document.querySelector('[data-kpi="cpu"]');
  const statCpu = document.getElementById("stat-cpu");
  const statCpuLoad = document.getElementById("stat-cpu-load");
  const statCpuBar = document.getElementById("stat-cpu-bar");
  let cpuTone = "ok";
  if (stats?.ok && stats.data?.cpu) {
    const usage = Number(stats.data.cpu.usagePercent) || 0;
    if (statCpu) statCpu.textContent = `${usage.toFixed(1)}%`;
    if (statCpuLoad) statCpuLoad.textContent = `Carga 1m: ${(Number(stats.data.cpu.loadAvg1m) || 0).toFixed(2)}`;
    if (statCpuBar) statCpuBar.style.width = `${Math.min(100, usage)}%`;
    cpuTone = toneFor("cpu", usage);
    applyKpiTone(cpuEl, cpuTone, cpuTone === "ok" ? "CPU en niveles normales" : cpuTone === "warn" ? `CPU al ${usage.toFixed(0)}% — vigilar carga` : `CPU al ${usage.toFixed(0)}% — riesgo de saturación`);
  } else {
    if (statCpu) statCpu.textContent = "—";
    if (statCpuLoad) statCpuLoad.textContent = "Sin datos";
    applyKpiTone(cpuEl, "ok", "Sin datos disponibles");
  }

  // Memory
  const memEl = document.querySelector('[data-kpi="mem"]');
  const statMem = document.getElementById("stat-mem");
  const statMemDetail = document.getElementById("stat-mem-detail");
  const statMemBar = document.getElementById("stat-mem-bar");
  let memTone = "ok";
  if (stats?.ok && stats.data?.memory) {
    const m = stats.data.memory;
    const usage = Number(m.usagePercent) || 0;
    if (statMem) statMem.textContent = `${usage.toFixed(1)}%`;
    if (statMemDetail) statMemDetail.textContent = `${fmtBytes(m.usedBytes)} de ${fmtBytes(m.totalBytes)}`;
    if (statMemBar) statMemBar.style.width = `${Math.min(100, usage)}%`;
    memTone = toneFor("mem", usage);
    applyKpiTone(memEl, memTone, memTone === "ok" ? "RAM con holgura" : memTone === "warn" ? `RAM al ${usage.toFixed(0)}% — riesgo de swap` : `RAM al ${usage.toFixed(0)}% — sin margen, posible OOM`);
  } else {
    if (statMem) statMem.textContent = "—";
    if (statMemDetail) statMemDetail.textContent = "Sin datos";
    applyKpiTone(memEl, "ok", "Sin datos disponibles");
  }

  return { cpuTone, memTone };
}

function renderDisk(disk) {
  const diskEl = document.querySelector('[data-kpi="disk"]');
  const statDisk = document.getElementById("stat-disk");
  const statDiskDetail = document.getElementById("stat-disk-detail");
  const statDiskBar = document.getElementById("stat-disk-bar");
  const foldersEl = document.getElementById("top-folders");
  let diskTone = "ok";

  if (disk?.ok && disk.data) {
    const d = disk.data;
    const usage = Number(d.usagePercent) || 0;
    if (statDisk) statDisk.textContent = `${usage.toFixed(1)}%`;
    if (statDiskDetail) statDiskDetail.textContent = `${fmtBytes(d.usedBytes)} de ${fmtBytes(d.totalBytes)} · libre ${fmtBytes(d.availableBytes)}`;
    if (statDiskBar) statDiskBar.style.width = `${Math.min(100, usage)}%`;
    diskTone = toneFor("disk", usage);
    applyKpiTone(diskEl, diskTone, diskTone === "ok" ? "Disco con espacio suficiente" : diskTone === "warn" ? `Disco al ${usage.toFixed(0)}% — limpiar logs/backups pronto` : `Disco al ${usage.toFixed(0)}% — riesgo inminente de quedar sin espacio`);

    if (foldersEl) {
      const folders = Array.isArray(d.topFolders) ? d.topFolders : [];
      if (folders.length === 0) {
        foldersEl.innerHTML = `<p class="text-xs text-muted-foreground">No se pudo medir el uso por carpeta.</p>`;
      } else {
        const max = folders[0]?.bytes || 1;
        foldersEl.innerHTML = folders.map((f) => {
          const pct = Math.min(100, Math.round((f.bytes / max) * 100));
          return `
            <div>
              <div class="flex items-center justify-between text-xs">
                <span class="truncate font-mono text-muted-foreground">${escapeHtml(f.path)}</span>
                <span class="font-medium tabular-nums">${fmtBytes(f.bytes)}</span>
              </div>
              <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-sky-500" style="width:${pct}%"></div>
              </div>
            </div>`;
        }).join("");
      }
    }
  } else {
    if (statDisk) statDisk.textContent = "—";
    if (statDiskDetail) statDiskDetail.textContent = "Sin datos";
    if (foldersEl) foldersEl.innerHTML = `<p class="text-xs text-muted-foreground">Sin datos disponibles.</p>`;
    applyKpiTone(diskEl, "ok", "Sin datos disponibles");
  }

  return diskTone;
}

const SERVICE_ICONS = {
  postfix: "ti-mail",
  dovecot: "ti-inbox",
  opendkim: "ti-key",
  nginx: "ti-server",
  apache: "ti-server",
  redis: "ti-database",
  "redis-server": "ti-database",
  fail2ban: "ti-shield",
  ufw: "ti-firewall",
};

function svcIcon(name) {
  const key = (name || "").toLowerCase();
  for (const [k, v] of Object.entries(SERVICE_ICONS)) {
    if (key.includes(k)) return v;
  }
  return "ti-circle";
}

function renderServices(services) {
  const list = document.getElementById("services-list");
  if (!list) return;
  if (!services?.ok || !Array.isArray(services.data)) {
    list.innerHTML = `<div class="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">No se pudo consultar el estado de servicios.</div>`;
    return;
  }
  const items = services.data;
  if (items.length === 0) {
    list.innerHTML = `<div class="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">No hay servicios reportados.</div>`;
    return;
  }
  list.innerHTML = items.map((s) => `
    <div class="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
      <div class="flex items-center gap-2.5">
        <i class="ti ${svcIcon(s.name)} text-sm text-muted-foreground"></i>
        <span class="text-sm font-medium">${escapeHtml(s.name)}</span>
      </div>
      <span class="flex items-center gap-1.5 text-xs font-medium ${s.active ? "text-emerald-500" : "text-destructive"}">
        <span class="h-2 w-2 rounded-full ${s.active ? "bg-emerald-500 animate-pulse" : "bg-destructive"}"></span>
        ${s.active ? "Activo" : "Inactivo"}
      </span>
    </div>`).join("");
}

function renderTopProcesses(top) {
  const el = document.getElementById("top-processes");
  if (!el) return;
  if (!top?.ok || !Array.isArray(top.data) || top.data.length === 0) {
    el.innerHTML = `<div class="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">No hay datos de procesos.</div>`;
    return;
  }
  // Sort descending by CPU then memory so the worst offender is always first.
  const rows = [...top.data].sort((a, b) => (b.cpuPercent - a.cpuPercent) || (b.memPercent - a.memPercent)).slice(0, 6);
  el.innerHTML = rows.map((p) => {
    const cpuTone = p.cpuPercent >= 80 ? "text-red-500" : p.cpuPercent >= 50 ? "text-amber-500" : "text-muted-foreground";
    const memTone = p.memPercent >= 30 ? "text-amber-500" : "text-muted-foreground";
    const name = (p.command || "").split("/").pop() || p.command || `pid ${p.pid}`;
    return `
      <div class="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium truncate" title="${escapeHtml(p.command)}">${escapeHtml(name)}</p>
          <p class="text-xs text-muted-foreground truncate">pid ${p.pid} · ${escapeHtml(p.user)}</p>
        </div>
        <div class="ml-3 flex shrink-0 flex-col items-end text-xs tabular-nums">
          <span class="${cpuTone} font-semibold">CPU ${p.cpuPercent.toFixed(1)}%</span>
          <span class="${memTone}">RAM ${p.memPercent.toFixed(1)}%</span>
        </div>
      </div>`;
  }).join("");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[c]);
}

const ACTION_LABELS = {
  login: "Inicio de sesión",
  logout: "Cierre de sesión",
  password_change: "Cambio de contraseña",
  passkey_register: "Passkey registrada",
  passkey_delete: "Passkey eliminada",
  recovery_code_used: "Código de recuperación usado",
  profile_update: "Perfil actualizado",
  "2fa_enabled": "2FA habilitado",
  "2fa_disabled": "2FA deshabilitado",
  account_create: "Cuenta de correo creada",
  account_delete: "Cuenta de correo eliminada",
  user_create: "Usuario creado",
  user_delete: "Usuario eliminado",
  backup_created: "Backup creado",
  cert_issued: "Certificado SSL emitido",
  cert_renewed: "Certificado SSL renovado",
  firewall_rule_add: "Regla de firewall añadida",
  firewall_rule_delete: "Regla de firewall eliminada",
};

const ACTION_ICONS = {
  login: "ti-login",
  logout: "ti-logout",
  password_change: "ti-key",
  passkey_register: "ti-fingerprint",
  account_create: "ti-mail-plus",
  account_delete: "ti-mail-minus",
  user_create: "ti-user-plus",
  user_delete: "ti-user-minus",
  backup_created: "ti-cloud-upload",
  cert_issued: "ti-certificate",
  cert_renewed: "ti-refresh",
  firewall_rule_add: "ti-shield-plus",
  firewall_rule_delete: "ti-shield-minus",
};

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

async function loadActivity() {
  if (!isDashboardPage()) return;
  const el = document.getElementById("activity-list");
  const empty = document.getElementById("activity-empty");
  if (!el || !empty) return;
  const res = await api.get("/api/preferences/audit-log?limit=8");
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
    el.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  el.innerHTML = res.data.map((e) => {
    const icon = ACTION_ICONS[e.action] ?? "ti-activity";
    const label = ACTION_LABELS[e.action] ?? e.action;
    return `
      <div class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/50 transition-colors">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${e.success !== false ? "bg-emerald-500/10" : "bg-destructive/10"}">
          <i class="ti ${icon} text-xs ${e.success !== false ? "text-emerald-500" : "text-destructive"}"></i>
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-sm truncate">${escapeHtml(label)}</p>
          ${e.ip ? `<p class="text-xs text-muted-foreground">${escapeHtml(e.ip)}${e.username ? ` · ${escapeHtml(e.username)}` : ""}</p>` : ""}
        </div>
        <span class="text-xs text-muted-foreground shrink-0">${relativeTime(e.created_at)}</span>
      </div>`;
  }).join("");
}

async function loadQuickActions() {
  const grid = document.getElementById("quick-actions-grid");
  const empty = document.getElementById("quick-actions-empty");
  if (!grid) return;
  let enabled = new Set();
  try {
    const res = await api.get("/api/modules/installed");
    if (res.ok && Array.isArray(res.data)) {
      for (const m of res.data) {
        const id = m?.id ?? m?.name;
        if (id) enabled.add(id);
      }
    }
  } catch {
    // best-effort — leave hidden items hidden so we don't surface modules
    // that might not actually work for the user.
  }

  let visible = 0;
  for (const link of grid.querySelectorAll(".quick-action")) {
    const moduleId = link.getAttribute("data-module");
    if (!moduleId || moduleId === "always") {
      link.style.display = "";
      visible++;
      continue;
    }
    if (enabled.has(moduleId)) {
      link.style.display = "";
      visible++;
    } else {
      link.style.display = "none";
    }
  }
  if (empty) {
    empty.classList.toggle("hidden", visible > 0);
  }
}

async function loadOverview() {
  if (!isDashboardPage()) return;
  const res = await api.get("/api/dashboard/overview");
  if (!res.ok || !res.data) {
    // Render an explicit failure state across all sections instead of leaving
    // skeleton placeholders glued to the page.
    renderStats({ ok: false });
    renderDisk({ ok: false });
    renderServices({ ok: false });
    renderTopProcesses({ ok: false });
    updateGlobalHealth(["ok"]);
    return;
  }
  const overview = res.data;
  const tones = renderStats(overview.stats);
  const diskTone = renderDisk(overview.disk);
  renderServices(overview.services);
  renderTopProcesses(overview.topProcesses);
  updateGlobalHealth([tones.cpuTone, tones.memTone, diskTone]);
}

function init() {
  if (!isDashboardPage()) return;
  if (dashboardStarted) return;
  dashboardStarted = true;

  loadQuickActions();
  loadOverview();
  loadActivity();

  pollers.push(setInterval(loadOverview, 30_000));
  pollers.push(setInterval(loadActivity, 60_000));

  document.addEventListener("astro:before-swap", () => {
    dashboardStarted = false;
    for (const id of pollers) clearInterval(id);
    pollers = [];
  }, { once: true });
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
