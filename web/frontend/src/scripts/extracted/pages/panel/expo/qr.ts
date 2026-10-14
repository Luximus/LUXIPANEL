// Expo page — shared QR dialog: live dev-client tunnel + per-build install QR.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import QRCode from "/scripts/extracted/vendor/qrcode-browser.js?v=2";
import { S } from "./state";
import type { DevClientResult, ExpoProject, ExpoBuild } from "./state";
import { t, esc, fmt, $, dlg, showToast, expoBuildStatusLabel } from "./dom";
import { renderLiveSessions } from "./live-sessions";

// ── Shared QR dialog ──────────────────────────────────────────────────────────
/** Set the dialog chrome (title/hint, stop-button visibility) and open it. */
export function openQrDialog(title: string, hint: string, showStop: boolean) {
  const titleEl = $("expo-qr-title");
  if (titleEl) titleEl.textContent = title;
  const hintEl = $("expo-qr-hint");
  if (hintEl) hintEl.textContent = hint;
  const stopBtn = $("expo-qr-stop");
  if (stopBtn) stopBtn.classList.toggle("hidden", !showStop);
  const urlEl = $("expo-qr-url");
  if (urlEl) urlEl.innerHTML = "";
  const d = dlg("dlg-expo-qr");
  if (d && !d.open) d.showModal();
}

/** Render a QR for `url` into the box, with an optional note + link/download. */
export async function renderQrResult(url: string, note: string, links: string) {
  const box = $("expo-qr-box");
  const urlEl = $("expo-qr-url");
  if (box) {
    box.innerHTML =
      `<canvas id="expo-qr-canvas" class="rounded-lg bg-white p-2"></canvas>` +
      (note ? `<p class="mt-2 text-xs text-muted-foreground">${esc(note)}</p>` : "");
    const canvas = document.getElementById("expo-qr-canvas") as HTMLCanvasElement | null;
    if (canvas) {
      try {
        await QRCode.toCanvas(canvas, url, { width: 220, errorCorrectionLevel: "M" });
      } catch {
        box.innerHTML = `<span class="text-sm text-destructive">${esc(t("devClient.qrError", "No se pudo generar el QR."))}</span>`;
      }
    }
  }
  if (urlEl) urlEl.innerHTML = links;
}

export function qrBoxMessage(html: string) {
  const box = $("expo-qr-box");
  if (box) box.innerHTML = html;
}

/**
 * Localized text for a failed dev-client start. The backend returns a stable
 * `messageCode` plus dynamic `detail` (raw stderr / log tail) so the panel can
 * translate the message instead of rendering the backend's Spanish `raw`.
 */
export function devClientErrorText(data: DevClientResult | undefined): string {
  const byCode: Record<string, string> = {
    expoMissing: t("devClient.expoMissing", "Faltan las dependencias del proyecto Expo. Usa Instalar dependencias antes de generar el QR."),
    ngrokMissing: t("devClient.ngrokMissing", "Falta @expo/ngrok para el túnel. Usa Instalar dependencias antes de generar el QR."),
    startFailed: t("devClient.startError", "No se pudo iniciar el servidor de pruebas."),
    exitedBeforeUrl: t("devClient.liveExited", "El servidor de pruebas se detuvo antes de exponer la URL."),
    exitedBeforeUrlNgrok: t(
      "devClient.liveExitedNgrok",
      "Falta @expo/ngrok en el proyecto para el túnel. El servidor de pruebas se detuvo antes de exponer la URL.",
    ),
    exitedBeforeUrlTunnel: t(
      "devClient.liveExitedTunnel",
      "El túnel de ngrok falló repetidamente. No es un problema de tu proyecto; vuelve a intentarlo en un momento.",
    ),
    timeout: t("devClient.liveTimeout", "Tiempo de espera agotado iniciando el túnel. Intenta de nuevo."),
  };
  const code = data?.messageCode ?? "";
  const msg = byCode[code];
  if (msg) {
    const detail = (data?.detail ?? "").trim();
    return detail ? `${msg}\n${detail}` : msg;
  }
  // No recognized code → fall back to the backend's raw string.
  return data?.raw ?? t("devClient.startError", "No se pudo iniciar el servidor de pruebas.");
}

// ── Live-testing tunnel (projects "QR" button) ────────────────────────────────
export async function startDevClient(project: ExpoProject) {
  if (S.devPending.has(project.path)) return;
  const generation = S.targetGeneration, root = $("expo-root");
  const current = () => generation === S.targetGeneration && $("expo-root") === root;
  S.devRevision.set(project.path, (S.devRevision.get(project.path) ?? 0) + 1);
  S.devPending.add(project.path);
  renderLiveSessions();
  S.devTestProject = project;
  openQrDialog(
    t("devClient.liveTitle", "Probar en vivo (dev-client)"),
    t("devClient.liveHint", "Inicia un servidor Metro con túnel en el servidor; escanéalo con tu app dev-client para probar con recarga en caliente."),
    true,
  );
  qrBoxMessage(
    `<span class="text-sm text-muted-foreground"><i class="ti ti-loader-2 animate-spin"></i> ${esc(t("devClient.starting", "Iniciando servidor de pruebas (túnel)... puede tardar ~30 s."))}</span>`,
  );
  const res = await api.post<DevClientResult>("/api/expo/dev-client", { path: project.path });
  if (!current()) return;
  S.devPending.delete(project.path);
  renderLiveSessions();
  if (!res.ok) {
    qrBoxMessage(`<span class="text-sm text-destructive">${esc(res.error ?? t("common.error", "Error"))}</span>`);
    return;
  }
  const data = res.data;
  if (!data?.url) {
    qrBoxMessage(
      `<span class="text-sm text-muted-foreground whitespace-pre-wrap text-left block">${esc(devClientErrorText(data))}</span>`,
    );
    return;
  }
  S.devSessions.set(project.path, { status: "running", url: data.url });
  renderLiveSessions();
  if (S.devTestProject?.path !== project.path || !dlg("dlg-expo-qr")?.open) return;
  await renderQrResult(
    data.url,
    t("devClient.liveScanHint", "Escanea el QR con tu app de desarrollo (dev-client) para probar en vivo con recarga en caliente."),
    `<span class="break-all">${esc(data.url)}</span>`,
  );
}

export async function stopDevClient(project: ExpoProject | null = S.devTestProject) {
  if (!project || S.devPending.has(project.path)) return;
  const generation = S.targetGeneration, root = $("expo-root");
  S.devRevision.set(project.path, (S.devRevision.get(project.path) ?? 0) + 1);
  S.devPending.add(project.path);
  renderLiveSessions();
  const res = await api.post("/api/expo/dev-client/stop", { path: project.path });
  if (generation !== S.targetGeneration || $("expo-root") !== root) return;
  S.devPending.delete(project.path);
  if (res.ok) {
    S.devSessions.delete(project.path);
    if (S.devTestProject?.path === project.path) { dlg("dlg-expo-qr")?.close(); S.devTestProject = null; }
  }
  renderLiveSessions();
  showToast(res.ok ? t("devClient.serverStopped", "Servidor de pruebas detenido") : (res.error ?? t("devClient.stopError", "No se pudo detener")), res.ok);
}

// ── Install / download a specific build (history table QR) ─────────────────────
export function showBuildInstallQr(build: ExpoBuild) {
  const url = build.url ?? build.artifactUrl ?? null;
  openQrDialog(t("history.installTitle", "Instalar build"), t("history.installHint", "Escanea para abrir la página de instalación de este build en tu dispositivo."), false);
  if (!url) {
    qrBoxMessage(`<span class="text-sm text-muted-foreground">${esc(t("history.installNoUrl", "Este build aún no tiene un enlace de instalación."))}</span>`);
    return;
  }
  const dl = build.artifactUrl
    ? ` · <a href="${esc(build.artifactUrl)}" target="_blank" rel="noopener" class="underline hover:text-foreground">${esc(t("history.downloadArtifact", "Descargar artefacto"))}</a>`
    : "";
  const note = build.status === "finished"
    ? t("history.installReady", "Build listo para instalar.")
    : fmt(t("history.installNotReady", "Estado: {status} — el enlace funcionará cuando termine."), { status: expoBuildStatusLabel(build.status) });
  void renderQrResult(
    url,
    note,
    `<a href="${esc(url)}" target="_blank" rel="noopener" class="underline hover:text-foreground break-all">${esc(url)}</a>${dl}`,
  );
}
