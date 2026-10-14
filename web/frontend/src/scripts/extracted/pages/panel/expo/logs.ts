// Expo page — build-logs viewer (search / errors-only) + AI failure analysis.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { S } from "./state";
import type { ExpoBuild, ExpoBuildLogLine, ExpoBuildLogs } from "./state";
import { t, esc, fmt, $, dlg, showToast, expoProfileLabel, expoBuildStatusLabel } from "./dom";

// ── Build logs viewer + AI analysis (history table) ───────────────────────────
/** bunyan level → text colour (50 error, 40 warn; rest default). */
export const LOG_LEVEL_TONE: Record<number, string> = {
  50: "text-destructive",
  40: "text-amber-500",
};

export function logLineToText(l: ExpoBuildLogLine): string {
  return `${l.phase ? `[${l.phase}] ` : ""}${l.msg}`;
}

/** Lines after the search + "errors only" filters. */
export function filteredLogLines(): ExpoBuildLogLine[] {
  const data = S.logsData;
  if (!data) return [];
  const q = S.logsSearch.trim().toLowerCase();
  return data.lines.filter((l) => {
    if (S.logsErrorsOnly && (l.level ?? 0) < 40) return false;
    if (q && !`${l.phase ?? ""} ${l.msg}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function renderLogLines() {
  const box = $("expo-logs-box");
  if (!box) return;
  const data = S.logsData;
  const lines = filteredLogLines();
  const note = data?.truncated
    ? `<div class="mb-2 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] text-amber-600">${esc(fmt(t("logs.truncated", "Registro recortado: mostrando las últimas {count} líneas."), { count: data.lines.length }))}</div>`
    : "";
  const count = data
    ? `<div class="mb-2 text-[10px] text-muted-foreground">${esc(fmt(t("logs.lineCount", "{visible} / {total} líneas"), { visible: lines.length, total: data.lines.length }))}</div>`
    : "";
  if (lines.length === 0) {
    box.innerHTML = `${note}<div class="py-8 text-center text-sm text-muted-foreground">${esc(t("logs.noMatch", "Sin líneas que coincidan."))}</div>`;
    return;
  }
  box.innerHTML =
    note +
    count +
    lines
      .map((l) => {
        const tone = LOG_LEVEL_TONE[l.level ?? 0] ?? "text-foreground/80";
        const ph = l.phase ? `<span class="text-muted-foreground">[${esc(l.phase)}]</span> ` : "";
        return `<div class="whitespace-pre-wrap break-words ${tone}">${ph}${esc(l.msg) || "&nbsp;"}</div>`;
      })
      .join("");
}

export async function showBuildLogs(build: ExpoBuild) {
  S.logsBuild = build;
  S.logsData = null;
  S.logsSearch = "";
  // Failed builds default to "errors only" so the cause is front and centre.
  S.logsErrorsOnly = build.status === "errored";
  const errsChk = $("expo-logs-errors-only") as HTMLInputElement | null;
  if (errsChk) errsChk.checked = S.logsErrorsOnly;
  const search = $("expo-logs-search") as HTMLInputElement | null;
  if (search) search.value = "";
  const sub = $("expo-logs-sub");
  if (sub)
    sub.textContent = [build.appName ?? S.currentProject?.name, build.platform, expoProfileLabel(build.profile ?? ""), expoBuildStatusLabel(build.status)]
      .filter(Boolean)
      .join(" · ");
  const errBox = $("expo-logs-error");
  if (errBox) {
    errBox.classList.add("hidden");
    errBox.innerHTML = "";
  }
  const open = $("expo-logs-open") as HTMLAnchorElement | null;
  if (open) {
    if (build.url) {
      open.href = build.url;
      open.classList.remove("hidden");
    } else open.classList.add("hidden");
  }
  // The AI button only makes sense for a failed build.
  const aiBtn = $("expo-logs-ai");
  if (aiBtn) aiBtn.classList.toggle("hidden", build.status !== "errored");
  const box = $("expo-logs-box");
  if (box) box.innerHTML = `<div class="py-8 text-center text-sm text-muted-foreground">${esc(t("logs.loading", "Cargando registro…"))}</div>`;
  const d = dlg("dlg-expo-logs");
  if (d && !d.open) d.showModal();

  const res = await api.post<ExpoBuildLogs>("/api/expo/build-logs", { buildId: build.id });
  if (S.logsBuild?.id !== build.id) return; // a newer dialog superseded this one
  if (!res.ok) {
    if (box)
      box.innerHTML = `<div class="py-8 text-center text-sm text-destructive">${esc(res.error ?? t("logs.fetchError", "No se pudo obtener el registro"))}</div>`;
    return;
  }
    if (!res.data) return;
  S.logsData = res.data;
  // Surface the structured EAS failure prominently above the raw log.
  if (res.data.error && errBox) {
    const e = res.data.error;
    const code = e.errorCode ? `<span class="font-mono font-semibold">${esc(e.errorCode)}</span>` : "";
    const msg = e.message ? `<div class="mt-0.5">${esc(e.message)}</div>` : "";
    const docs = e.docsUrl
      ? `<div class="mt-1"><a href="${esc(e.docsUrl)}" target="_blank" rel="noopener" class="underline">${esc(t("logs.docs", "Documentación ↗"))}</a></div>`
      : "";
    errBox.innerHTML = `<div class="flex items-start gap-2 text-destructive"><i class="ti ti-alert-triangle mt-0.5"></i><div>${code}${msg}${docs}</div></div>`;
    errBox.classList.remove("hidden");
  }
  renderLogLines();
}

/** Error/warn lines (the failure context) or the log tail, for copy / AI. */
export function buildLogPlainText(maxLines = 300): string {
  const data = S.logsData;
  if (!data) return "";
  const errorLines = data.lines.filter((l) => (l.level ?? 0) >= 40);
  const base = errorLines.length > 0 ? errorLines : data.lines;
  return base.slice(-maxLines).map(logLineToText).join("\n");
}

export function analyzeLogsWithAI() {
  const build = S.logsBuild;
  const data = S.logsData;
  if (!build || !data) return;
  const proj = S.currentProject;
  const errBlock = data.error
    ? fmt(t("logs.structuredError", "Error EAS: {code} — {message}"), {
        code: data.error.errorCode ?? "",
        message: data.error.message ?? "",
      }).trim()
    : t("logs.noStructuredError", "El build no expone un error estructurado; deduce la causa del registro.");
  const prompt = fmt(
    t(
      "logs.aiPrompt",
      "Analiza el fallo de este build de EAS (Expo) y dime la causa raíz y los pasos concretos para resolverlo en el servidor conectado.\n\nProyecto: {projectName} ({projectPath})\nBuild: {buildId} · {platform} · perfil {profile} · estado {status}\n{expoLine}\n{errorBlock}\n\nRegistro relevante:\n```\n{logText}\n```\n",
    ),
    {
      projectName: proj?.name ?? build.appName ?? "?",
      projectPath: proj?.path ?? "?",
      buildId: build.id,
      platform: build.platform,
      profile: build.profile ?? "?",
      status: build.status,
      expoLine: build.url ? `Expo: ${build.url}` : "",
      errorBlock: errBlock,
      logText: buildLogPlainText(300),
    },
  );
  dlg("dlg-expo-logs")?.close();
  requestAssistant({
    kind: "prompt",
    prompt,
    submit: "auto",
    conversation: "new",
    origin: { module: "expo", action: "sendLogs" },
    target: { agentId: null, projectId: null },
  });
  showToast(t("logs.analyzing", "Abriendo el asistente IA para analizar el error…"));
}

export async function copyBuildLogs() {
  const data = S.logsData;
  if (!data) return;
  try {
    await navigator.clipboard.writeText(data.lines.map(logLineToText).join("\n"));
    showToast(t("logs.copied", "Registro copiado"));
  } catch {
    showToast(t("logs.copyError", "No se pudo copiar"), false);
  }
}
