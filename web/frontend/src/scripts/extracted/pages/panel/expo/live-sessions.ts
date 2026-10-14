import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import QRCode from "/scripts/extracted/vendor/qrcode-browser.js?v=2";
import { S, type ExpoProject, type DevClientStatus } from "./state";
import { $, t, esc } from "./dom";

export function liveSessionMarkup(project: ExpoProject, idx: number, blocked = "", hint = ""): string {
  const session = S.devSessions.get(project.path), pending = S.devPending.has(project.path);
  const stop = `<button data-idx="${idx}" style="min-height:44px;min-width:100px" class="expo-devclient-stop inline-flex items-center justify-center gap-1 rounded-md border border-destructive/40 bg-background px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40" ${pending ? "disabled" : ""} aria-label="${esc(`${t("devClient.stop", "Detener")} — ${project.name}`)}"><i class="ti ti-player-stop text-sm" aria-hidden="true"></i> ${esc(t("devClient.stop", "Detener"))}</button>`;
  if (session?.status === "running" && session.url) return `<div class="flex flex-col items-center gap-2 rounded-md border border-border bg-background p-2" style="width:164px;max-width:100%">
    <canvas data-expo-live-qr data-qr-url="${esc(session.url)}" role="img" aria-label="${esc(`${t("projects.devClient", "Probar por QR")} — ${project.name}`)}" style="display:block;width:144px;height:144px;max-width:100%;background:#fff;border-radius:4px"></canvas>
    ${stop}</div>`;
  if (session?.status === "starting") return `<div class="flex flex-col gap-2 rounded-md border border-border bg-background p-2" style="max-width:220px"><span class="text-[11px] text-muted-foreground" role="status">${esc(t("devClient.starting", "Iniciando servidor de pruebas…"))}</span>${stop}</div>`;
  return `<button data-idx="${idx}" ${pending ? "disabled" : blocked} class="expo-devclient inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" title="${blocked ? hint : esc(t("projects.devClient", "Probar por QR"))}"><i class="ti ti-qrcode text-sm" aria-hidden="true"></i> ${esc(t("projects.qrButton", "QR"))}</button>`;
}

export async function renderLiveSessionCanvases() {
  const canvases = $("expo-projects")?.querySelectorAll<HTMLCanvasElement>("[data-expo-live-qr]") ?? [];
  await Promise.all(Array.from(canvases, async canvas => {
    if (canvas.dataset.qrRendered) return;
    canvas.dataset.qrRendered = "true";
    try { await QRCode.toCanvas(canvas, canvas.dataset.qrUrl!, { width: 144, margin: 4, errorCorrectionLevel: "M" }); }
    catch {
      canvas.dataset.qrRendered = "";
      const error = document.createElement("span");
      error.className = "text-[11px] text-destructive";
      error.textContent = t("devClient.qrError", "No se pudo generar el QR.");
      if (canvas.isConnected) canvas.replaceWith(error);
    }
  }));
}

/** Update only the session cell, preserving project controls and keyboard focus. */
export function renderLiveSessions() {
  $("expo-projects")?.querySelectorAll<HTMLElement>("[data-expo-session-path]").forEach(cell => {
    const idx = S.projects.findIndex(p => p.path === cell.dataset.expoSessionPath), project = S.projects[idx];
    if (!project) return;
    const blocked = !project.runtime?.expoInstalled || !project.runtime?.ngrokInstalled;
    const hint = !project.runtime?.expoInstalled ? t("projects.dependenciesMissing", "Faltan dependencias del proyecto (expo)") : t("projects.ngrokMissing", "Falta @expo/ngrok para el QR");
    const markup = liveSessionMarkup(project, idx, blocked ? 'disabled aria-disabled="true"' : "", esc(hint));
    if (cell.dataset.sessionMarkup === markup) return;
    cell.innerHTML = markup;
    cell.dataset.sessionMarkup = markup;
  });
  void renderLiveSessionCanvases();
}

let refresh: { generation: number; root: HTMLElement; work: Promise<void> } | null = null;
export function refreshLiveSessions(): Promise<void> {
  const root = $("expo-root"), generation = S.targetGeneration;
  if (!root) return Promise.resolve();
  if (refresh?.root === root && refresh.generation === generation) return refresh.work;
  const projects = [...S.projects];
  const current = () => S.targetGeneration === generation && $("expo-root") === root;
  const work = (async () => {
    let index = 0;
    async function worker() {
      while (index < projects.length && current()) {
        const project = projects[index++];
        if (!project || S.devPending.has(project.path)) continue;
        const revision = S.devRevision.get(project.path) ?? 0;
        try {
          const path = `/api/expo/dev-client/status?path=${encodeURIComponent(project.path)}`;
          let result = await api.get<DevClientStatus>(path);
          if (!result.ok && result.code === "TARGET_SCOPE_CHANGED" && current() && !S.devPending.has(project.path) && revision === (S.devRevision.get(project.path) ?? 0)) {
            await new Promise(resolve => setTimeout(resolve, 150));
            if (!current() || S.devPending.has(project.path) || revision !== (S.devRevision.get(project.path) ?? 0)) continue;
            result = await api.get<DevClientStatus>(path);
          }
          if (!current() || S.devPending.has(project.path) || revision !== (S.devRevision.get(project.path) ?? 0)) continue;
          if (result.ok && result.data) S.devSessions.set(project.path, result.data);
          else S.devSessions.delete(project.path);
        } catch {
          if (current() && !S.devPending.has(project.path) && revision === (S.devRevision.get(project.path) ?? 0)) S.devSessions.delete(project.path);
        }
        if (current()) renderLiveSessions();
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, projects.length) }, worker));
  })();
  refresh = { generation, root, work };
  void work.finally(() => { if (refresh?.work === work) refresh = null; });
  return work;
}

let timer: ReturnType<typeof setInterval> | undefined;
export function bindLiveSessions() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    const root = $("expo-root");
    if (!root) { clearInterval(timer); timer = undefined; return; }
    if (!document.hidden && root.getClientRects().length) void refreshLiveSessions();
  }, 15000);
}
