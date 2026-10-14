import { api, saveMailServer, selectedMailServer } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { resolveTargetScope as panelTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { getClientMessages } from "/scripts/extracted/lib/i18n-client.js";
import { switchView } from "/scripts/extracted/lib/dom.js";

type Server = { id: string; name: string; host?: string };
type Settings = { current: Server; servers: Server[]; imapPort: number; smtpPort: number };
let mountGeneration = 0;

/** Settings can live in a separate workspace iframe from the mailbox list. */
export function refreshMailModule(): void {
  try {
    if (window.parent !== window) {
      const parentDocument = window.parent.document;
      const settingsFrame = parentDocument.getElementById("workspace-settings-frame") as HTMLIFrameElement | null;
      const moduleFrame = parentDocument.getElementById("workspace-quick-frame") as HTMLIFrameElement | null;
      const moduleWindow = moduleFrame?.contentWindow;
      if (settingsFrame?.contentWindow === window && moduleWindow) {
        const url = new URL(moduleWindow.location.href);
        if (url.origin === window.location.origin && /^\/panel\/mail(?:\/|$)/.test(url.pathname)) {
          // The workspace's existing close handler dismisses the overlay.
          // Reloading both frames discards their old mailbox ids and API scope.
          const dialog = document.getElementById("mail-settings-modal") as HTMLDialogElement | null;
          if (dialog?.open) dialog.close();
          moduleWindow.location.reload();
        }
      }
    }
  } catch { /* A detached or cross-origin frame keeps the direct-page fallback. */ }
  window.location.reload();
}

/** Dynamic section shares the existing drawer and works across Astro navigation. */
export async function mountMailServerSettings(): Promise<void> {
  const modal = document.getElementById("mail-settings-modal");
  const nav = modal?.querySelector("nav");
  const content = modal?.querySelector('[data-mail-settings-view="table"]')?.parentElement;
  if (!modal || !nav || !content || modal.querySelector('[data-mail-settings-view="server"]')) return;
  const generation = ++mountGeneration;
  let messages: Record<string, unknown>;
  try { messages = await getClientMessages(document.documentElement.lang, ["mail"]); }
  catch { return; }
  if (generation !== mountGeneration || !modal.isConnected) return;
  const copy = (messages.mail as { serverConnection: Record<string, string> }).serverConnection;
  if (!copy) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = nav.querySelector("button")?.className ?? "";
  button.dataset.mailSettingsOpen = "server";
  button.dataset.mailSettingsNav = "server";
  button.title = copy.title;
  const icon = document.createElement("i");
  icon.className = "ti ti-server shrink-0 text-lg";
  icon.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "hidden truncate @xl:inline";
  label.textContent = copy.title;
  button.append(icon, label);
  nav.append(button);
  const section = document.createElement("section");
  section.dataset.mailSettingsView = "server";
  section.className = "hidden space-y-4";
  // Only static markup goes through innerHTML. All translations and server
  // names are assigned with textContent/Option to avoid interpreting HTML.
  section.innerHTML = `<h4 class="text-sm font-semibold" data-title></h4>
    <p class="text-xs text-muted-foreground" data-intro></p>
    <form class="rounded-xl border border-border bg-background p-4 space-y-4">
      <div class="space-y-1.5"><label for="mail-server-select" class="text-sm font-medium"></label>
        <select id="mail-server-select" class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none" disabled></select></div>
      <p class="text-xs text-muted-foreground" data-endpoints dir="auto"></p>
      <p class="text-xs text-muted-foreground" data-hint></p>
      <p class="text-sm text-muted-foreground" data-status role="status" aria-live="polite"></p>
      <button type="submit" class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled>
        <i class="ti ti-loader-2 animate-spin hidden" data-spinner aria-hidden="true"></i><span></span>
      </button>
    </form>`;
  section.querySelector("[data-title]")!.textContent = copy.title;
  section.querySelector("[data-intro]")!.textContent = copy.intro;
  section.querySelector("label")!.textContent = copy.serverLabel;
  section.querySelector("[data-hint]")!.textContent = copy.hint;
  section.querySelector("button span")!.textContent = copy.apply;
  content.append(section);
  const select = section.querySelector("select")!;
  const submit = section.querySelector("button")!;
  const status = section.querySelector<HTMLElement>("[data-status]")!;
  const endpoints = section.querySelector("[data-endpoints]")!;
  let settings: Settings | null = null;
  let loading = false;
  const selected = selectedMailServer();
  const banner = selected ? document.createElement("p") : null;
  if (banner) {
    banner.className = "mb-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm";
    banner.dataset.mailServerBanner = "";
    banner.textContent = copy.title;
    document.querySelector('[data-mail-main-panel="emails"]')?.prepend(banner);
  }
  const reflect = () => {
    const server = settings?.servers.find(server => server.id === select.value);
    endpoints.textContent = server ? `IMAP: ${server.host}:${settings!.imapPort} · SMTP: ${server.host}:${settings!.smtpPort}` : copy.currentHint;
  };
  const load = async () => {
    if (loading) return;
    loading = true;
    const scope = panelTargetScope();
    select.disabled = submit.disabled = true;
    status.textContent = copy.loading;
    try {
      const response = await api.get<Settings>("/api/mail/server-settings");
      if (!modal.isConnected || scope !== panelTargetScope()) return;
      if (!response.ok || !response.data) { status.textContent = response.error ?? copy.loadError; return; }
      const loaded = response.data;
      settings = loaded;
      if (banner) banner.textContent = copy.active.replace("{server}", loaded.servers.find(server => server.id === selected)?.name ?? copy.unavailable);
      select.replaceChildren(new Option(`${copy.current} (${loaded.current.name})`, ""));
      for (const server of loaded.servers) select.add(new Option(`${server.name} — ${server.host}`, server.id));
      if (selected && !loaded.servers.some(server => server.id === selected)) {
        const unavailable = new Option(copy.unavailable, selected);
        unavailable.disabled = true;
        select.add(unavailable);
        status.textContent = copy.unavailableHint;
      } else status.textContent = loaded.servers.length ? "" : copy.empty;
      select.value = selected;
      select.disabled = submit.disabled = false;
      reflect();
    } catch { status.textContent = copy.loadError; }
    finally { loading = false; }
  };
  button.addEventListener("click", (event) => {
    event.stopImmediatePropagation();
    const panels = Array.from(modal.querySelectorAll<HTMLElement>("[data-mail-settings-view]"));
    switchView(panels, section, { direction: "right" });
    nav.querySelectorAll<HTMLElement>("[data-mail-settings-nav]").forEach(item => {
      const active = item === button;
      item.classList.toggle("bg-primary/10", active);
      item.classList.toggle("text-primary", active);
      item.classList.toggle("text-muted-foreground", !active);
      if (active) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
    });
    void load();
  });
  select.addEventListener("change", reflect);
  section.querySelector("form")!.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const scope = panelTargetScope();
    const targetId = select.value;
    select.disabled = submit.disabled = true;
    section.querySelector("[data-spinner]")!.classList.remove("hidden");
    status.textContent = copy.connecting;
    try {
      const result = await api.post("/api/mail/server-settings/validate", { targetId });
      if (!modal.isConnected || scope !== panelTargetScope()) return;
      if (!result.ok) { status.textContent = result.error ?? copy.connectError; return; }
      saveMailServer(targetId);
      refreshMailModule();
    } catch { status.textContent = copy.connectError; }
    finally {
      select.disabled = submit.disabled = false;
      section.querySelector("[data-spinner]")!.classList.add("hidden");
    }
  });
  if (selected) void load();
}
