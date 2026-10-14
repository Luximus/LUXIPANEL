import {
  api,
  resolvePanelApiPath,
  resolveTargetScope,
  scopeHeaders,
} from "/scripts/extracted/lib/api-client.js";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";


/** Campos del repositorio (API de GitHub) que consume esta página. */
interface GithubRepo {
  full_name: string;
  description?: string | null;
  html_url: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  subscribers_count?: number;
  watchers_count?: number;
  language?: string | null;
  license?: { name?: string } | null;
  created_at?: string;
  pushed_at?: string;
  topics?: string[];
  default_branch?: string;
}

const { loadI18n, t, fmt } = createPageI18n("repositoryStore-i18n");
const ui = (key: string, fallback: string) => t(`runtime.${key}`, fallback);
const pageLocale = () => document.documentElement.lang || undefined;

function initScript({ fullName }: { fullName: string }) {
  // Dedup guard: Astro ClientRouter re-executes inline define:vars scripts on
  // every SPA navigation. Without this, click handlers (install/uninstall) get
  // registered twice and fire two API requests on a single button click.
  // Keyed by fullName so navigating to a different repo always re-initializes.
  const rootElement = document.getElementById("repo-detail-root");
  if ((window as any).__lxp_repo_root === rootElement) return;
  (window as any).__lxp_repo_root = rootElement;
  loadI18n();
  const els = {
    loading: document.getElementById("detail-loading")!,
    content: document.getElementById("detail-content")!,
    error: document.getElementById("detail-error")!,
    install: document.getElementById("detail-install")!,
    update: document.getElementById("detail-update")!,
    uninstall: document.getElementById("detail-uninstall")!,
    title: document.getElementById("repo-title")!,
    status: document.getElementById("repo-status")!,
    description: document.getElementById("repo-description")!,
    link: document.getElementById("repo-github-link") as HTMLAnchorElement,
    stars: document.getElementById("repo-stars")!,
    forks: document.getElementById("repo-forks")!,
    issues: document.getElementById("repo-issues")!,
    watchers: document.getElementById("repo-watchers")!,
    language: document.getElementById("repo-language")!,
    license: document.getElementById("repo-license")!,
    created: document.getElementById("repo-created")!,
    pushed: document.getElementById("repo-pushed")!,
    topics: document.getElementById("repo-topics")!,
    readmeLoading: document.getElementById("readme-loading")!,
    readmeContent: document.getElementById("readme-content")!,
    readmeEmpty:   document.getElementById("readme-empty")!,
    readmeError:   document.getElementById("readme-error")!,
    clones: document.getElementById("detail-clones")!,
  };
  let repoData: GithubRepo | null = null;
  let savedNames: string[] = [];
  let clones: any[] = [];
  let canGit = false;
  async function loadState() {
    const result = await api.get<any>("/api/repository-store/state");
    if (!result.ok || !result.data) return;
    savedNames = result.data.saved || [];
    const legacyKey = `lxp-github-store-installed-v1:${resolveTargetScope()}`;
    try {
      const names = Object.keys(JSON.parse(localStorage.getItem(legacyKey) || "{}") || {})
        .filter((name) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)).slice(0, 500);
      if (names.length) {
        const migrated = await api.post<any>("/api/repository-store/saved", { fullNames: names, saved: true });
        if (migrated.ok) { savedNames = migrated.data.saved; localStorage.removeItem(legacyKey); }
      }
    } catch { /* Legacy browser storage may be unavailable. */ }
    clones = (result.data.clones || []).filter((item: any) => item.fullName.toLowerCase() === fullName.toLowerCase());
    renderActions(); renderClones();
  }
  function renderClones() {
    const esc = escapeHtml;
    els.clones.innerHTML = clones.length ? clones.map((clone) => `<div class="rounded-xl border border-border p-3"><p class="font-mono text-xs">${esc(clone.path)}</p><p class="mt-1 text-xs text-muted-foreground">${clone.statusError ? esc(clone.statusError) : clone.checkedAt ? esc(fmt(ui("cloneSyncStatus", "{behind} detrás · {ahead} delante{dirty}"), { behind: clone.behind || 0, ahead: clone.ahead || 0, dirty: clone.dirty ? ui("localChanges", " · cambios locales") : "" })) : esc(ui("unchecked", "Sin comprobar"))}</p><div class="mt-3 flex flex-wrap gap-2"><button data-action="check" data-id="${esc(clone.id)}" class="rounded-lg border border-border px-3 py-1.5 text-xs">${esc(ui("check", "Comprobar"))}</button>${clone.behind > 0 && !clone.ahead && !clone.dirty && !clone.statusError ? `<button data-action="update" data-id="${esc(clone.id)}" class="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground">${esc(t("actions.actualizar", "Actualizar"))}</button>` : ""}<button data-action="unlink" data-id="${esc(clone.id)}" class="rounded-lg border border-border px-3 py-1.5 text-xs">${esc(ui("unlink", "Desvincular"))}</button></div></div>`).join("") : `<p class="text-sm text-muted-foreground">${esc(ui("noClones", "Sin copias registradas para este repositorio."))}</p>`;
  }
  function renderActions() {
    const isSaved = savedNames.some((name) => name.toLowerCase() === fullName.toLowerCase());
    els.install.classList.toggle("hidden", isSaved);
    els.update.classList.remove("hidden");
    els.update.toggleAttribute("disabled", !canGit);
    els.update.title = canGit ? t("catalogUi.cloneRepository", "Clonar repositorio") : ui("gitPermissionRequired", "Requiere permiso Git de Archivos");
    els.uninstall.classList.toggle("hidden", !isSaved);
    els.status.textContent = clones.length ? fmt(ui("serverCopiesCount", "{count} copias en el servidor"), { count: clones.length }) : isSaved ? ui("saved", "Guardado") : ui("publicRepository", "Repositorio público");
  }
  async function fetchRepo() {
    const endpoint = resolvePanelApiPath(`/api/repository-store/repos/${fullName.split("/").map(encodeURIComponent).join("/")}`);
    try {
      const res = await fetch(endpoint, { credentials: "include", headers: scopeHeaders() });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      repoData = (await res.json()).data;
      renderRepo();
      // Kick off README fetch in parallel — it's slower because GitHub
      // server-side renders the markdown to HTML.
      void fetchReadme();
    } catch {
      els.error.textContent = t("errors.fetchRepoFailed", "No se pudo cargar el repositorio solicitado desde GitHub.");
      els.error.classList.remove("hidden");
    } finally {
      els.loading.classList.add("hidden");
    }
  }

  async function fetchReadme() {
    if (!els.readmeLoading) return;
    const [owner, name] = fullName.split("/");
    if (!owner || !name) return;
    try {
      const url = `${resolvePanelApiPath("/api/repository-store/readme")}?owner=${encodeURIComponent(owner)}&name=${encodeURIComponent(name)}`;
      const res = await fetch(url, { credentials: "include", headers: scopeHeaders() });
      const json = await res.json().catch(() => ({}));
      els.readmeLoading.classList.add("hidden");

      if (res.status === 404 || (json && json.status === 404)) {
        els.readmeEmpty.classList.remove("hidden");
        return;
      }
      if (!res.ok || !json.ok) {
        els.readmeError.textContent = json.error || fmt(t("errors.readmeFailed", "No se pudo cargar el README ({status})."), { status: res.status });
        els.readmeError.classList.remove("hidden");
        return;
      }
      // GitHub already sanitizes the rendered HTML server-side. We still
      // strip <script> as a belt-and-suspenders measure.
      // GitHub already sanitizes the rendered HTML server-side, but the
      // comment "GitHub already sanitizes" is brittle: a poisoned branch,
      // a future change, or a different fetch path can ship inline event
      // handlers / `<svg onload>` / CSS-exfil via `<style>` past any naive
      // regex. Run the rendered HTML through the same DOMPurify pipeline the
      // assistant chat uses. We import the vendor bundle lazily (matches the
      // chat-script pattern) so we don't add a fixed top-level cost to pages
      // that never open a README.
      let safeHtml: string | null = null;
      try {
        const mod: { DOMPurify?: { sanitize: (s: string, opts?: Record<string, unknown>) => string } } =
          await import("/scripts/extracted/vendor/markdown.js" as string);
        if (mod?.DOMPurify) {
          safeHtml = mod.DOMPurify.sanitize(String(json.html || ""), {
            ALLOWED_TAGS: [
              "a", "abbr", "b", "blockquote", "br", "code", "del", "details",
              "div", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i",
              "img", "ins", "kbd", "li", "mark", "ol", "p", "pre", "s",
              "samp", "span", "strong", "sub", "summary", "sup", "table",
              "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "var",
            ],
            ALLOWED_ATTR: [
              "href", "title", "alt", "src", "class", "colspan", "rowspan",
              "start", "type", "align",
            ],
            ALLOW_DATA_ATTR: false,
            FORBID_TAGS: ["style", "iframe", "object", "embed", "form", "script"],
            FORBID_ATTR: ["style", "onload", "onerror", "onclick"],
          });
        }
        // else: DOMPurify missing → leave safeHtml null (handled below).
      } catch {
        safeHtml = null;
      }
      if (safeHtml === null) {
        // Sanitizer unavailable (network / cold SW cache / partial deploy). Do
        // NOT innerHTML a naive `<script>`-only regex-strip of third-party HTML:
        // `<img onerror>`, `<svg onload>` and `<iframe srcdoc>` all survive it.
        // Show a plain-text notice instead of rendering untrusted markup.
        els.readmeError.textContent = t("errors.readmeSanitizerUnavailable", "No se pudo renderizar el README de forma segura. Ábrelo en GitHub.");
        els.readmeError.classList.remove("hidden");
        return;
      }
      els.readmeContent.innerHTML = safeHtml;
      els.readmeContent.classList.remove("hidden");

      // GitHub does NOT absolutize relative URLs in the rendered HTML.
      // Relative paths in <img src> and <a href> point to repo files —
      // rewrite them so they resolve outside github.com.
      absolutizeReadmeUrls(owner, name, repoData?.default_branch || "main");

      // Force external links to open in a new tab.
      els.readmeContent.querySelectorAll("a[href]").forEach((a) => {
        const href = a.getAttribute("href") || "";
        if (/^https?:/i.test(href)) {
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
        }
      });
    } catch (err) {
      els.readmeLoading.classList.add("hidden");
      els.readmeError.textContent = t("errors.readmeConnectionFailed", "Error de conexión al cargar el README.");
      els.readmeError.classList.remove("hidden");
    }
  }

  /**
   * Rewrite relative URLs inside the README so images/links work outside
   * github.com. Images go through raw.githubusercontent.com; links to repo
   * files go through github.com/<owner>/<name>/blob/<branch>/<path>.
   * Skips already-absolute URLs and in-page anchors (#section).
   */
  function absolutizeReadmeUrls(owner: string, name: string, branch: string) {
    const branchPath = branch.split("/").map(encodeURIComponent).join("/");
    const RAW = `https://raw.githubusercontent.com/${owner}/${name}/${branchPath}/`;
    const BLOB = `https://github.com/${owner}/${name}/blob/${branchPath}/`;

    function resolve(value: string | null | undefined, base: string) {
      if (!value) return value;
      const trimmed = value.trim();
      if (/^(?:https?:|data:|mailto:|#)/i.test(trimmed)) return value;
      // Strip leading "./" and any leading slashes.
      const normalized = trimmed.replace(/^\/+/, "");
      return new URL(normalized, base).href;
    }

    els.readmeContent.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      const next = resolve(src, RAW);
      if (next && next !== src) img.setAttribute("src", next);
      // Lazy-load to avoid layout jank on big READMEs.
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
    });

    els.readmeContent.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      const next = resolve(href, BLOB);
      if (next && next !== href) a.setAttribute("href", next);
    });
  }
  function renderRepo() {
    if (!repoData) return;
    els.title.textContent = repoData.full_name;
    els.description.textContent = repoData.description || t("labels.sinDescripcion", "Sin descripción");
    els.link.href = repoData.html_url;
    els.stars.textContent = Number(repoData.stargazers_count || 0).toLocaleString(pageLocale());
    els.forks.textContent = Number(repoData.forks_count || 0).toLocaleString(pageLocale());
    els.issues.textContent = Number(repoData.open_issues_count || 0).toLocaleString(pageLocale());
    els.watchers.textContent = Number(repoData.subscribers_count || 0).toLocaleString(pageLocale());
    els.language.textContent = repoData.language || t("labels.noEspecificado", "No especificado");
    els.license.textContent = repoData.license?.name || t("labels.sinLicencia", "Sin licencia");
    els.created.textContent = repoData.created_at ? new Date(repoData.created_at).toLocaleString(pageLocale()) : "—";
    els.pushed.textContent = repoData.pushed_at ? new Date(repoData.pushed_at).toLocaleString(pageLocale()) : "—";
    const topics = Array.isArray(repoData.topics) && repoData.topics.length > 0 ? repoData.topics : [ui("noTopics", "Sin temas")];
    els.topics.innerHTML = topics.map((topic: string) => `<span class="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">${escapeHtml(String(topic))}</span>`).join("");
    renderActions();
    els.content.classList.remove("hidden");
  }
  async function changeSaved(value: boolean) {
    const response = await api.post<any>("/api/repository-store/saved", { fullNames: [fullName], saved: value });
    if (!response.ok) { els.error.textContent = response.error || ui("saveError", "No se pudo guardar"); els.error.classList.remove("hidden"); return; }
    savedNames = response.data.saved;
    toast(value ? ui("repositorySaved", "Repositorio guardado") : ui("savedRemoved", "Guardado retirado"));
    renderActions();
  }
  async function cloneAction(action: string, id: string) {
    const clone = clones.find((item) => item.id === id);
    if (!clone) return;
    if (action === "unlink" && !confirm(fmt(ui("unlinkConfirm", "¿Desvincular {path}? La carpeta y sus archivos quedarán intactos."), { path: clone.path }))) return;
    if (action === "update" && !confirm(fmt(ui("updateConfirm", "¿Actualizar {path} mediante avance rápido de la rama actual?"), { path: clone.path }))) return;
    const endpoint = `/api/repository-store/clones/${encodeURIComponent(id)}`;
    const response = action === "unlink" ? await api.delete(endpoint) : await api.post<any>(`${endpoint}/${action}`, {});
    if (!response.ok) { els.error.textContent = response.error || ui("gitOperationError", "La operación Git falló."); els.error.classList.remove("hidden"); return; }
    if (action === "unlink") clones = clones.filter((item) => item.id !== id);
    else if (action === "check") clones = clones.map((item) => item.id === id ? response.data : item);
    else if (action === "update") clones = clones.map((item) => item.id === id ? response.data.clone : item);
    els.error.classList.add("hidden"); renderClones(); renderActions();
  }
  function toast(message: string, subtle = false) {
    const node = document.createElement("div");
    node.className = `fixed bottom-6 right-6 z-50 rounded-xl border px-4 py-2 text-sm font-medium shadow-xl transition-all duration-300 translate-y-2 opacity-0 ${subtle ? "border-border bg-card text-foreground" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`;
    node.textContent = message;
    document.body.appendChild(node);
    requestAnimationFrame(() => node.classList.remove("translate-y-2", "opacity-0"));
    setTimeout(() => {
      node.classList.add("translate-y-2", "opacity-0");
      setTimeout(() => node.remove(), 300);
    }, 2200);
  }
  function escapeHtml(value: string) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  const settingsTrigger = document.getElementById("repo-settings-trigger");
  const settingsForm = document.getElementById("repo-settings-form") as HTMLFormElement | null;
  const linkForm = document.getElementById("repo-link-form") as HTMLFormElement | null;
  async function loadSettings() {
    const [savedState, config, git] = await Promise.all([
      api.get<any>("/api/repository-store/state"),
      api.get<any>("/api/repository-store/config"),
      api.get<any>("/api/files/git/detect"),
    ]);
    if (savedState.ok && settingsForm) {
      for (const [key, value] of Object.entries(savedState.data?.preferences || {})) {
        const field = settingsForm.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement | null;
        if (field?.type === "checkbox") (field as HTMLInputElement).checked = Boolean(value);
        else if (field) field.value = String(value);
      }
    }
    const token = document.getElementById("repo-settings-token");
    if (token) token.textContent = !config.ok ? ui("tokenCheckError", "No se pudo consultar el token") : config.data?.tokenValid === false ? ui("tokenRejected", "El token de catálogo fue rechazado por GitHub") : config.data?.tokenConfigured ? ui("catalogTokenConfigured", "Token de catálogo configurado") : ui("noCatalogToken", "Sin token de catálogo");
    const gitStatus = document.getElementById("repo-settings-git");
    if (gitStatus) gitStatus.textContent = git.ok && git.data?.git?.installed
      ? fmt(ui("gitConnectionStatus", "{version} · SSH: {count} llaves · gh: {status}"), { version: git.data.git.version, count: git.data?.sshKeys?.length || 0, status: git.data?.gh?.authenticated ? ui("connected", "conectado") : ui("signedOut", "sin sesión") })
      : ui("gitUnavailable", "Sin permiso Git de Archivos o conexión Git no disponible");
  }
  settingsTrigger?.addEventListener("click", () => void loadSettings());
  settingsForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const field = (name: string) => settingsForm.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
    const patch = {
      defaultTab: field("defaultTab").value,
      sort: field("sort").value,
      pageSize: Number(field("pageSize").value),
      showArchived: (field("showArchived") as HTMLInputElement).checked,
      cloneParent: field("cloneParent").value.trim(),
      transport: field("transport").value,
    };
    const result = await api.patch<any>("/api/repository-store/preferences", patch);
    const message = document.getElementById("repo-settings-message");
    if (message) message.textContent = result.ok ? ui("settingsSaved", "Configuración guardada") : (result.error || ui("saveError", "No se pudo guardar"));
  });
  linkForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const field = (name: string) => (linkForm.elements.namedItem(name) as HTMLInputElement).value.trim();
    const linkedName = field("fullName");
    const message = document.getElementById("repo-link-message");
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(linkedName)) {
      if (message) message.textContent = ui("ownerRepoFormat", "Usa owner/repo.");
      return;
    }
    const result = await api.post<any>("/api/repository-store/clones/link", { fullName: linkedName, path: field("path") });
    if (message) message.textContent = result.ok ? ui("cloneLinked", "Copia vinculada") : (result.error || ui("linkError", "No se pudo vincular"));
    if (result.ok) { linkForm.reset(); void loadState(); }
  });
  els.install.addEventListener("click", () => void changeSaved(true));
  els.update.addEventListener("click", () => { window.location.href = `/panel/repository-store?clone=${encodeURIComponent(fullName)}`; });
  els.uninstall.addEventListener("click", () => void changeSaved(false));
  els.clones.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]");
    if (button?.dataset.id && button.dataset.action) void cloneAction(button.dataset.action, button.dataset.id);
  });
  void loadState();
  void api.get<any>("/api/files/git/detect").then((result) => { canGit = Boolean(result.ok && result.data?.git?.installed); renderActions(); });
  void fetchRepo();
}
export {
  initScript as default
};
