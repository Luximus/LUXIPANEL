// Cron page — log viewer (shared by jobs + agents).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { t, fmt, $, dlg, esc } from "./dom";
import { openDialog } from "/scripts/extracted/lib/dom.js";

  // ---------------------------------------------------------------------------
  // Log viewer (shared by jobs + agents)
  // ---------------------------------------------------------------------------
  let logsCtx: { kind: "job" | "agent"; id: string; user?: string; file?: string } | null = null;
  const logsBase = (kind: string, id: string) => kind === "agent" ? `/api/cron/ai-jobs/${encodeURIComponent(id)}/logs` : `/api/cron/jobs/${encodeURIComponent(id)}/logs`;
  const logsQuery = () => logsCtx?.kind === "job" && logsCtx.user ? `?user=${encodeURIComponent(logsCtx.user)}` : "";

  export async function openLogs(kind: "job" | "agent", id: string, name: string, user?: string) {
    logsCtx = { kind, id, user };
    $("logs-title")!.textContent = fmt(t("logs.titleFor", "Registros — {name}"), { name });
    $("logs-content")!.textContent = "";
    $("logs-run-title")!.textContent = t("logs.pickRun", "Selecciona una ejecución");
    openDialog("dialog-logs");
    await loadRuns();
  }
  async function loadRuns() {
    if (!logsCtx) return;
    const res = await api.get<any>(`${logsBase(logsCtx.kind, logsCtx.id)}${logsQuery()}`);
    const el = $("logs-runs")!;
    const runs = res.ok ? ((res.data as any[]) ?? []) : [];
    if (runs.length === 0) { el.innerHTML = `<div class="px-4 py-6 text-center text-xs text-muted-foreground">${t("logs.empty", "Sin ejecuciones")}</div>`; return; }
    el.innerHTML = runs.map((r) => {
      const ts = r.startedAt ? new Date(r.startedAt).toLocaleString(document.documentElement.lang || "es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : r.file;
      const badge = r.running ? `<span class="text-amber-500">${t("logs.running", "● corriendo")}</span>`
        : r.exitCode === 0 ? `<span class="text-emerald-500">${fmt(t("logs.ok", "✓ {ms}ms"), { ms: r.durationMs ?? 0 })}</span>`
        : `<span class="text-destructive">${fmt(t("logs.exitError", "✗ exit {code}"), { code: r.exitCode })}</span>`;
      return `<button onclick="openLogFile('${esc(r.file)}')" class="block w-full text-left px-4 py-2 hover:bg-muted/40 ${logsCtx?.file === r.file ? "bg-muted/40" : ""}">
        <div class="text-xs font-medium">${ts}</div><div class="text-xs mt-0.5">${badge}</div></button>`;
    }).join("");
  }
  (window as any).openLogFile = async (file: string) => {
    if (!logsCtx) return;
    logsCtx.file = file;
    $("logs-run-title")!.textContent = file;
    const res = await api.get<any>(`${logsBase(logsCtx.kind, logsCtx.id)}/${encodeURIComponent(file)}${logsQuery()}`);
    $("logs-content")!.textContent = res.ok ? ((res.data as any)?.content || t("logs.contentEmpty", "(vacío)")) : t("logs.contentError", "Error al leer el registro");
    const c = $("logs-content")!; c.scrollTop = c.scrollHeight;
    loadRuns();
  };
  async function onLogsRefresh() {
    if (logsCtx?.file) await (window as any).openLogFile(logsCtx.file); else await loadRuns();
  }

  export function wireLogs() {
    $("logs-close")?.addEventListener("click", () => dlg("dialog-logs")!.close());
    $("logs-refresh")?.addEventListener("click", () => void onLogsRefresh());
  }
