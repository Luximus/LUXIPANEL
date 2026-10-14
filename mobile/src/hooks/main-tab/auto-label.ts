import { getPanelHost, getPanelSubdomainLabel } from "../../features/app/utils";
import { panelContextLabelFromUrl } from "../../features/app/panel-context-label";
import type { Panel } from "../../types/models";
import type { View } from "../../features/app/types";

/** Une el subdominio (nombre del panel) con un contexto opcional, en el formato
 *  "<subdominio> - <contexto>" (p. ej. "ats - Terminal", "ats - <título chat>"). */
function withContext(base: string, context: string | null | undefined): string {
  const ctx = context?.trim();
  return ctx ? `${base} - ${ctx}` : base;
}

/**
 * Cálculo PURO del auto-rótulo de la pestaña (fase de refactor: extraído del
 * efecto de `useMainTabController`). Misma lógica, mismo orden de casos.
 */
export function computeTabAutoLabel({
  view,
  sshUrl,
  sshWebviewUrl,
  panels,
  activePanelId,
  visibleComposerStarted,
  visibleServerPanelId,
  visibleChatTitle,
}: {
  view: View;
  sshUrl: string;
  sshWebviewUrl: string | null;
  panels: Panel[];
  activePanelId: string | null;
  visibleComposerStarted: boolean;
  visibleServerPanelId: string | null;
  visibleChatTitle: string | null | undefined;
}): string {
  if (view === "ssh" && sshUrl) {
    // Etiqueta de la pestaña = SUBDOMINIO del panel conectado (p. ej.
    // "backend"), no el subdominio rotatorio de la URL. En modo invitado no
    // hay panel, así que se cae al primer segmento del host de la URL.
    let subdomain = "";
    const panel = activePanelId ? panels.find((p) => p.id === activePanelId) : null;
    if (panel) {
      const host = getPanelHost(panel);
      if (host && host !== "-") subdomain = getPanelSubdomainLabel(host);
    }
    if (!subdomain) {
      try { subdomain = new URL(sshUrl).hostname.split(".")[0] ?? ""; } catch { /* noop */ }
    }
    // Dentro del panel: añade el módulo/terminal activo según la URL navegada.
    return withContext(subdomain || "Servers", panelContextLabelFromUrl(sshWebviewUrl));
  }
  if (view === "support") return "Support";
  if (view === "security") return "Security";
  if (view === "blogfeed") return "Blog";
  if (view === "publicaciones") return "Publicaciones";
  if (view === "jobs") return "Jobs";
  // Dashboard: si el usuario YA inició conversación en el panel visible, la
  // pestaña toma el nombre (subdominio) de ese panel + el título/resumen del
  // chat ("<subdominio> - <título>"); si no, "Servers".
  if (visibleComposerStarted && visibleServerPanelId) {
    const panel = panels.find((p) => p.id === visibleServerPanelId);
    const host = panel ? getPanelHost(panel) : "";
    const subdomain = host && host !== "-" ? getPanelSubdomainLabel(host) : "";
    return withContext(subdomain || "Servers", visibleChatTitle);
  }
  return "Servers";
}
