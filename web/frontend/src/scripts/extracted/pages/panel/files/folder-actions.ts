// Files page — folder-actions submodule (code-move from index-script1.ts; no behavior change).
import { fmt, t } from "./i18n";
import { escapeAttr, escapeHtml, getBaseName } from "./paths";
import { selected } from "./state";
import { showToast } from "./toast";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { ASSISTANT_AGENTS_UPDATED_EVENT } from "/scripts/extracted/lib/panel-events.js";


  // ── Folder → terminal snippets generator ─────────────────────
  // Analyzes a folder on the server (cd routes for root + subfolders, git /
  // GitHub commands, install/build/run by toolchain) and registers the chosen
  // ones as terminal snippets via the terminal module's bulk-import endpoint.
  export const SNIPPET_TAG_ORDER = [
    "navigate", "inspect", "git", "github", "node", "run", "build", "test",
    "check", "python", "php", "rust", "go", "make", "docker",
  ];

  export async function openFolderSnippetsDialog(folderPath: string) {
    const tagLabels: Record<string, string> = {
      navigate: t("snippets.tagNavigate", "Navegación"),
      inspect: t("snippets.tagInspect", "Inspección"),
      git: "Git", github: "GitHub", node: "Node",
      run: t("snippets.tagRun", "Ejecutar"),
      build: t("snippets.tagBuild", "Compilar"),
      test: t("snippets.tagTest", "Pruebas"),
      check: t("snippets.tagCheck", "Verificación"),
      python: "Python", php: "PHP", rust: "Rust", go: "Go", make: "Make", docker: "Docker",
    };

    document.getElementById("folder-snippets-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "folder-snippets-overlay";
    overlay.className = "fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4";
    overlay.innerHTML = `
      <div class="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div class="min-w-0">
            <h3 class="flex items-center gap-2 text-sm font-semibold text-foreground"><i class="ti ti-terminal-2"></i>${t("snippets.title", "Generar snippets de terminal")}</h3>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">${escapeHtml(folderPath)}</p>
          </div>
          <button id="fsnip-close" class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><i class="ti ti-x text-base"></i></button>
        </div>
        <div class="border-b border-border px-4 py-3">
          <label class="mb-1 block text-xs font-medium text-muted-foreground">${t("snippets.category", "Categoría")}</label>
          <input id="fsnip-category" type="text" maxlength="128" class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary" />
        </div>
        <div id="fsnip-body" class="flex-1 overflow-y-auto px-4 py-3 text-sm">
          <div class="py-8 text-center text-muted-foreground">${fmt(t("status.analyzingPath", "Analizando {path}…"), { path: escapeHtml(folderPath) })}</div>
        </div>
        <div class="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <label class="flex items-center gap-2 text-xs text-muted-foreground"><input id="fsnip-all" type="checkbox" class="h-4 w-4 accent-primary" checked /> <span>${t("snippets.selectAll", "Seleccionar todo")}</span></label>
          <div class="flex items-center gap-2">
            <button id="fsnip-cancel" class="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent">${t("actions.cancel", "Cancelar")}</button>
            <button id="fsnip-import" class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50" disabled>${t("snippets.import", "Importar")}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector("#fsnip-close")?.addEventListener("click", close);
    overlay.querySelector("#fsnip-cancel")?.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    // close() (not overlay.remove()) so the global keydown listener is also torn
    // down — otherwise it survives the SPA nav and keeps the overlay/data alive.
    document.addEventListener("astro:before-swap", () => close(), { once: true });

    type FSnip = { name: string; command: string; tags: string[] };
    let plan: FSnip[] = [];
    try {
      const res: any = await api.get("/api/files/snippets/suggest", { params: { path: folderPath } });
      if (!res.ok || !res.data) throw new Error(res.error || t("toasts.genericError", "Ocurrió un error"));
      plan = Array.isArray(res.data.snippets) ? res.data.snippets : [];
      const catInput = overlay.querySelector<HTMLInputElement>("#fsnip-category");
      if (catInput) catInput.value = String(res.data.category || getBaseName(folderPath) || t("snippets.defaultCategory", "Carpeta"));
    } catch (err: any) {
      const errBody = overlay.querySelector("#fsnip-body");
      if (errBody) errBody.innerHTML = `<div class="py-8 text-center text-destructive">${escapeHtml(err?.message || t("toasts.genericError", "Ocurrió un error"))}</div>`;
      return;
    }
    if (!overlay.isConnected) return; // closed while loading

    const body = overlay.querySelector("#fsnip-body");
    const importBtn = overlay.querySelector<HTMLButtonElement>("#fsnip-import");
    if (!body) return;
    if (plan.length === 0) {
      body.innerHTML = `<div class="py-8 text-center text-muted-foreground">${t("snippets.empty", "No se generaron comandos para esta carpeta.")}</div>`;
      return;
    }

    // Group by primary tag, ordered by SNIPPET_TAG_ORDER (unknowns last).
    const groups = new Map<string, number[]>();
    plan.forEach((s, idx) => {
      const key = (s.tags && s.tags[0]) || "other";
      let bucket = groups.get(key);
      if (!bucket) { bucket = []; groups.set(key, bucket); }
      bucket.push(idx);
    });
    const orderedKeys = Array.from(groups.keys()).sort((a, b) => {
      const ia = SNIPPET_TAG_ORDER.indexOf(a); const ib = SNIPPET_TAG_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    body.innerHTML = orderedKeys.map((key) => {
      const label = tagLabels[key] || key;
      const rows = groups.get(key)!.map((idx) => {
        const s = plan[idx];
        return `
          <label class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
            <input type="checkbox" class="fsnip-cb mt-0.5 h-4 w-4 accent-primary" data-idx="${idx}" checked />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm text-foreground">${escapeHtml(s.name)}</span>
              <code class="block truncate font-mono text-xs text-muted-foreground">${escapeHtml(s.command)}</code>
            </span>
          </label>`;
      }).join("");
      return `<div class="mb-3"><div class="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">${escapeHtml(label)} <span class="opacity-60">(${groups.get(key)!.length})</span></div>${rows}</div>`;
    }).join("");

    const cbs = () => Array.from(overlay.querySelectorAll<HTMLInputElement>(".fsnip-cb"));
    const refreshImport = () => {
      const n = cbs().filter((c) => c.checked).length;
      if (importBtn) {
        importBtn.disabled = n === 0;
        importBtn.textContent = n === 0 ? t("snippets.import", "Importar") : fmt(t("snippets.importN", "Importar {n}"), { n });
      }
    };
    refreshImport();
    body.addEventListener("change", refreshImport);
    const allToggle = overlay.querySelector<HTMLInputElement>("#fsnip-all");
    allToggle?.addEventListener("change", () => {
      cbs().forEach((c) => { c.checked = allToggle.checked; });
      refreshImport();
    });

    importBtn?.addEventListener("click", async () => {
      const chosen = cbs().filter((c) => c.checked).map((c) => plan[Number(c.getAttribute("data-idx"))]).filter(Boolean);
      if (chosen.length === 0) return;
      const category = (overlay.querySelector<HTMLInputElement>("#fsnip-category")?.value || "").trim() || getBaseName(folderPath) || t("snippets.defaultCategory", "Carpeta");
      importBtn.disabled = true;
      importBtn.textContent = t("snippets.importing", "Importando…");
      try {
        const res: any = await api.post("/api/terminal/snippets/import", {
          category,
          snippets: chosen.map((s) => ({ name: s.name, command: s.command, tags: s.tags || [] })),
        });
        if (!res.ok || !res.data) throw new Error(res.error || t("toasts.genericError", "Ocurrió un error"));
        const created = Array.isArray(res.data.created) ? res.data.created.length : 0;
        const skipped = Number(res.data.skipped || 0);
        window.dispatchEvent(new CustomEvent("lxp-terminal:reload-snippets"));
        showToast(skipped > 0
          ? fmt(t("snippets.importedSome", "{created} snippets creados · {skipped} ya existían"), { created, skipped })
          : fmt(t("snippets.imported", "{created} snippets creados en \"{category}\""), { created, category }));
        close();
      } catch (err: any) {
        importBtn.disabled = false;
        refreshImport();
        showToast(err?.message || t("toasts.genericError", "Ocurrió un error"), false);
      }
    });
  }

  // ── Create a new Expo / React-Native app in a folder ─────────
  // Scaffolds via the Expo module's detached create job (create-expo-app +
  // best-effort eas init), polls until done, and optionally starts the Metro
  // test server (QR). The selected folder is the PARENT of the new app folder.
  export async function openCreateExpoAppDialog(parentPath: string) {
    const TEMPLATES = [
      { value: "default", label: t("createApp.tplDefault", "Default (recomendado)") },
      { value: "blank", label: "Blank" },
      { value: "blank-typescript", label: "Blank + TypeScript" },
      { value: "tabs", label: t("createApp.tplTabs", "Tabs (navegación)") },
    ];
    const canAssistant = (window as any).__lxpCanAssistant !== false;

    document.getElementById("create-expo-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "create-expo-overlay";
    overlay.className = "fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4";
    overlay.innerHTML = `
      <div class="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div class="min-w-0">
            <h3 class="flex items-center gap-2 text-sm font-semibold text-foreground"><i class="ti ti-device-mobile-plus"></i>${t("createApp.title", "Crear app Expo")}</h3>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">${escapeHtml(parentPath)}</p>
          </div>
          <button id="cxa-close" class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><i class="ti ti-x text-base"></i></button>
        </div>
        <div id="cxa-body" class="flex-1 overflow-y-auto px-4 py-4 text-sm">
          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">${t("createApp.name", "Nombre de la app")}</label>
              <input id="cxa-name" type="text" spellcheck="false" autocomplete="off" maxlength="80" placeholder="${escapeAttr(t("createApp.namePlaceholder", "mi-app"))}" class="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-primary" />
              <p class="mt-1 text-[11px] text-muted-foreground">${t("createApp.nameHint", "Solo letras, números, '.', '_' y '-'. Se crea una carpeta con este nombre dentro de la actual.")}</p>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">${t("createApp.template", "Plantilla")}</label>
              <select id="cxa-template" class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary">
                ${TEMPLATES.map((tpl) => `<option value="${escapeHtml(tpl.value)}">${escapeHtml(tpl.label)}</option>`).join("")}
              </select>
            </div>
            ${canAssistant ? `<label class="flex items-start gap-2 text-sm">
              <input id="cxa-plan" type="checkbox" checked class="mt-0.5 h-4 w-4 accent-primary" />
              <span class="flex flex-col">
                <span class="text-foreground">${t("createApp.planAfter", "Generar el plan del proyecto (.md) con IA")}</span>
                <span class="text-[11px] text-muted-foreground">${t("createApp.planAfterHint", "Al terminar, el asistente IA crea PLAN.md, ARQUITECTURA.md, PANTALLAS.md y ROADMAP.md dentro de la nueva carpeta.")}</span>
              </span>
            </label>` : ""}
            <label class="flex items-start gap-2 text-sm">
              <input id="cxa-start" type="checkbox" checked class="mt-0.5 h-4 w-4 accent-primary" />
              <span class="flex flex-col">
                <span class="text-foreground">${t("createApp.startAfter", "Iniciar servidor de pruebas (QR) al terminar")}</span>
                <span class="text-[11px] text-muted-foreground">${t("createApp.startAfterHint", "Levanta Metro con túnel para probar en tu móvil con la app Expo dev-client.")}</span>
              </span>
            </label>
          </div>
        </div>
        <div id="cxa-footer" class="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button id="cxa-cancel" class="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent">${t("actions.cancel", "Cancelar")}</button>
          <button id="cxa-go" class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"><i class="ti ti-sparkles text-sm"></i> ${t("createApp.create", "Crear")}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    let pollTimer: any = null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const close = () => { if (pollTimer) clearInterval(pollTimer); overlay.remove(); document.removeEventListener("keydown", onKey); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector("#cxa-close")?.addEventListener("click", close);
    overlay.querySelector("#cxa-cancel")?.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    // close() also clears pollTimer and removes the keydown listener.
    document.addEventListener("astro:before-swap", () => close(), { once: true });

    const nameRe = /^[a-z0-9][a-z0-9._-]*$/i;

    const renderProgress = (projectPath: string) => {
      const body = overlay.querySelector("#cxa-body");
      const footer = overlay.querySelector("#cxa-footer");
      if (body) body.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-sm text-foreground"><i class="ti ti-loader-2 animate-spin"></i> ${t("createApp.running", "Creando la app… esto puede tardar varios minutos.")}</div>
          <p class="truncate font-mono text-[11px] text-muted-foreground">${escapeHtml(projectPath)}</p>
          <pre id="cxa-log" class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-snug text-muted-foreground"></pre>
        </div>`;
      if (footer) footer.innerHTML = `<button id="cxa-cancel2" class="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent">${t("createApp.hideClose", "Cerrar (sigue en segundo plano)")}</button>`;
      overlay.querySelector("#cxa-cancel2")?.addEventListener("click", close);
    };

    const finishOk = async (projectPath: string, startAfter: boolean, planAfter: boolean, template: string) => {
      const body = overlay.querySelector("#cxa-body");
      const footer = overlay.querySelector("#cxa-footer");
      // Refresh the file listing behind the dialog so the new folder shows.
      try { (window as any).navigate(projectPath); } catch { /* noop */ }
      let devNote = "";
      if (startAfter) {
        if (body) {
          const note = document.createElement("div");
          note.id = "cxa-dev";
          note.className = "mt-3 flex items-center gap-2 text-xs text-muted-foreground";
          note.innerHTML = `<i class="ti ti-loader-2 animate-spin"></i> ${t("createApp.startingDev", "Iniciando servidor de pruebas (túnel)…")}`;
          body.appendChild(note);
        }
        try {
          const dev: any = await api.post("/api/expo/dev-client", { path: projectPath });
          if (dev.ok && dev.data?.url) {
            devNote = `<div class="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs"><div class="font-medium text-emerald-600 dark:text-emerald-400">${t("createApp.devReady", "Servidor de pruebas listo")}</div><code class="mt-1 block break-all font-mono text-[11px] text-muted-foreground">${escapeHtml(dev.data.url)}</code></div>`;
          } else {
            devNote = `<div class="mt-2 text-xs text-muted-foreground">${escapeHtml(dev.data?.raw || dev.error || t("createApp.devFail", "No se pudo iniciar el servidor de pruebas; inícialo desde el módulo Expo."))}</div>`;
          }
        } catch (e: any) {
          devNote = `<div class="mt-2 text-xs text-muted-foreground">${escapeHtml(e?.message || t("createApp.devFail", "No se pudo iniciar el servidor de pruebas; inícialo desde el módulo Expo."))}</div>`;
        }
      }
      const willPlan = planAfter && canAssistant;
      if (body) body.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400"><i class="ti ti-circle-check"></i> ${t("createApp.doneOk", "App creada y lista.")}</div>
          <p class="truncate font-mono text-[11px] text-muted-foreground">${escapeHtml(projectPath)}</p>
          ${devNote}
          ${willPlan ? `<p class="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><i class="ti ti-robot"></i> ${t("createApp.planning", "El asistente IA está generando el plan (.md) del proyecto…")}</p>` : ""}
          <p class="mt-1 text-xs text-muted-foreground">${t("createApp.doneHint", "El proyecto aparece en el módulo Expo, donde puedes generar builds, QR y publicar.")}</p>
        </div>`;
      if (footer) footer.innerHTML = `
        <a href="/panel/expo" class="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent">${t("createApp.openExpo", "Abrir módulo Expo")}</a>
        <button id="cxa-done" class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">${t("actions.close", "Cerrar")}</button>`;
      overlay.querySelector("#cxa-done")?.addEventListener("click", close);
      // Hand the new project off to the AI assistant to write the .md build plan
      // INTO the just-created folder (auto-sent — same channel as "Abrir con agente IA").
      if (willPlan) {
        const planPrompt = fmt(
          t(
            "createApp.planPrompt",
            "Acabo de crear una app Expo / React Native en `{path}` (plantilla {template}). " +
              "Genera el plan del proyecto en archivos Markdown DENTRO de esa carpeta: " +
              "`PLAN.md` (objetivo y alcance), `ARQUITECTURA.md` (estructura de carpetas, navegación con expo-router o React Navigation, estado y librerías), " +
              "`PANTALLAS.md` (pantallas y componentes), `ROADMAP.md` (fases y tareas paso a paso) y `README.md`. " +
              "El plan debe explicar cómo construir la app con React + Expo. Después ayúdame a implementarla paso a paso. " +
              "Usa las herramientas de archivos para crear los `.md` y las de Expo del panel (build EAS, dev-client/QR, OTA) cuando haga falta.",
          ),
          { path: projectPath, template },
        );
        requestAssistant({
          kind: "prompt",
          prompt: planPrompt,
          submit: "auto",
          conversation: "new",
          origin: { module: "files", action: "createPlan" },
        });
      }
      showToast(t("createApp.toastDone", "App Expo creada"));
    };

    const finishError = (projectPath: string, message: string, logText: string) => {
      const body = overlay.querySelector("#cxa-body");
      const footer = overlay.querySelector("#cxa-footer");
      if (body) body.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-sm font-medium text-destructive"><i class="ti ti-alert-triangle"></i> ${escapeHtml(message || t("createApp.doneError", "La creación falló."))}</div>
          <p class="truncate font-mono text-[11px] text-muted-foreground">${escapeHtml(projectPath)}</p>
          ${logText ? `<pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-snug text-muted-foreground">${escapeHtml(logText)}</pre>` : ""}
        </div>`;
      if (footer) footer.innerHTML = `<button id="cxa-done" class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">${t("actions.close", "Cerrar")}</button>`;
      overlay.querySelector("#cxa-done")?.addEventListener("click", close);
    };

    const startPolling = (projectPath: string, startAfter: boolean, planAfter: boolean, template: string) => {
      // SPA leak guard: a previous startPolling() may not have fully torn
      // down yet (modal reopened before close cleared the handle). Always
      // clear the previous interval before scheduling a new one.
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      const deadline = Date.now() + 15 * 60 * 1000; // 15-minute cap
      let busy = false;
      pollTimer = window.setInterval(async () => {
        if (busy) return;
        busy = true;
        try {
          const res: any = await api.post("/api/expo/create-status", { path: projectPath });
          if (res.ok && res.data) {
            const logEl = overlay.querySelector<HTMLElement>("#cxa-log");
            if (logEl && typeof res.data.log === "string") {
              logEl.textContent = res.data.log;
              logEl.scrollTop = logEl.scrollHeight;
            }
            if (res.data.done) {
              clearInterval(pollTimer);
              pollTimer = null;
              if (res.data.ok) await finishOk(projectPath, startAfter, planAfter, template);
              else finishError(projectPath, res.data.message || "", res.data.log || "");
              return;
            }
          }
        } catch { /* transient — keep polling until the deadline */ } finally {
          busy = false;
        }
        if (Date.now() > deadline) {
          clearInterval(pollTimer);
          pollTimer = null;
          finishError(projectPath, t("createApp.timeout", "Tiempo de espera agotado. Revisa el módulo Expo."), "");
        }
      }, 4000);
    };

    overlay.querySelector("#cxa-go")?.addEventListener("click", async () => {
      const name = (overlay.querySelector<HTMLInputElement>("#cxa-name")?.value || "").trim();
      const template = overlay.querySelector<HTMLSelectElement>("#cxa-template")?.value || "default";
      const startAfter = overlay.querySelector<HTMLInputElement>("#cxa-start")?.checked ?? false;
      const planAfter = overlay.querySelector<HTMLInputElement>("#cxa-plan")?.checked ?? false;
      if (!nameRe.test(name)) {
        showToast(t("createApp.invalidName", "Nombre de app inválido"), false);
        return;
      }
      const goBtn = overlay.querySelector<HTMLButtonElement>("#cxa-go");
      if (goBtn) { goBtn.disabled = true; goBtn.innerHTML = `<i class="ti ti-loader-2 animate-spin text-sm"></i> ${t("createApp.starting", "Iniciando…")}`; }
      try {
        const res: any = await api.post("/api/expo/create-app", { root: parentPath, name, template });
        if (!res.ok || !res.data) throw new Error(res.error || t("toasts.genericError", "Ocurrió un error"));
        if (res.data.status === "error") {
          if (goBtn) { goBtn.disabled = false; goBtn.innerHTML = `<i class="ti ti-sparkles text-sm"></i> ${t("createApp.create", "Crear")}`; }
          showToast(res.data.message || t("createApp.startFail", "No se pudo iniciar la creación"), false);
          return;
        }
        const projectPath = res.data.projectPath as string;
        renderProgress(projectPath);
        startPolling(projectPath, startAfter, planAfter, template);
      } catch (err: any) {
        if (goBtn) { goBtn.disabled = false; goBtn.innerHTML = `<i class="ti ti-sparkles text-sm"></i> ${t("createApp.create", "Crear")}`; }
        showToast(err?.message || t("toasts.genericError", "Ocurrió un error"), false);
      }
    });

    setTimeout(() => overlay.querySelector<HTMLInputElement>("#cxa-name")?.focus(), 50);
  }

  // ── Propose & create AI agents to manage a folder/project ────
  // Asks the assistant backend to analyze the folder and propose a team of
  // specialized agents; the user reviews/edits/selects them, then the chosen
  // ones are created (POST /api/ai/agents), each bound to the folder.
  export const PROPOSE_PROVIDERS = ["claude", "codex", "gemini", "deepseek", "grok", "minimax"];

  export async function openProposeAgentsDialog(folderPath: string) {
    document.getElementById("propose-agents-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "propose-agents-overlay";
    overlay.className = "fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4";
    overlay.innerHTML = `
      <div class="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div class="min-w-0">
            <h3 class="flex items-center gap-2 text-sm font-semibold text-foreground"><i class="ti ti-users-group"></i>${t("proposeAgents.title", "Proponer agentes IA para la carpeta")}</h3>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">${escapeHtml(folderPath)}</p>
          </div>
          <button id="pag-close" class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><i class="ti ti-x text-base"></i></button>
        </div>
        <div id="pag-body" class="flex-1 overflow-y-auto px-4 py-4 text-sm">
          <div class="flex items-center justify-center gap-2 py-10 text-center text-muted-foreground"><i class="ti ti-loader-2 animate-spin"></i> ${t("proposeAgents.analyzing", "Analizando la carpeta y proponiendo agentes…")}</div>
        </div>
        <div id="pag-footer" class="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button id="pag-cancel" class="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent">${t("actions.cancel", "Cancelar")}</button>
          <button id="pag-create" class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50" disabled>${t("proposeAgents.create", "Crear agentes")}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector("#pag-close")?.addEventListener("click", close);
    overlay.querySelector("#pag-cancel")?.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    // close() also removes the global keydown listener (not just the overlay).
    document.addEventListener("astro:before-swap", () => close(), { once: true });

    type Proposal = { name: string; description: string; systemPrompt: string; providerId: string; model: string; allowedTools: string[] | null; icon: string; color: string; projectPaths: string[] };
    let proposals: Proposal[] = [];
    try {
      const res: any = await api.post("/api/ai/agents/propose-from-folder", { path: folderPath });
      if (!res.ok || !res.data) throw new Error(res.error || t("toasts.genericError", "Ocurrió un error"));
      proposals = Array.isArray(res.data.agents) ? res.data.agents : [];
    } catch (err: any) {
      const errBody = overlay.querySelector("#pag-body");
      if (errBody) errBody.innerHTML = `<div class="py-10 text-center text-destructive">${escapeHtml(err?.message || t("toasts.genericError", "Ocurrió un error"))}</div>`;
      return;
    }
    if (!overlay.isConnected) return;

    const body = overlay.querySelector("#pag-body");
    const createBtn = overlay.querySelector<HTMLButtonElement>("#pag-create");
    if (!body) return;
    if (proposals.length === 0) {
      body.innerHTML = `<div class="py-10 text-center text-muted-foreground">${t("proposeAgents.empty", "No se propusieron agentes para esta carpeta.")}</div>`;
      return;
    }

    const provOptions = (sel: string) => PROPOSE_PROVIDERS.map((p) => `<option value="${p}" ${p === sel ? "selected" : ""}>${p}</option>`).join("");
    body.innerHTML = `
      <p class="mb-3 text-xs text-muted-foreground">${t("proposeAgents.intro", "Revisa y edita los agentes propuestos. Se crearán enlazados a esta carpeta.")}</p>
      <div class="space-y-3">
        ${proposals.map((p, i) => `
          <div class="rounded-lg border border-border p-3">
            <div class="flex items-start gap-2">
              <input type="checkbox" class="pag-cb mt-1 h-4 w-4 accent-primary" data-idx="${i}" checked />
              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <input class="pag-name min-w-[8rem] flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm font-medium text-foreground outline-none focus:border-primary" data-idx="${i}" maxlength="120" value="${escapeAttr(p.name)}" />
                  <select class="pag-prov rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary" data-idx="${i}">${provOptions(p.providerId)}</select>
                </div>
                <input class="pag-desc w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground outline-none focus:border-primary" data-idx="${i}" maxlength="500" value="${escapeAttr(p.description)}" placeholder="${t("proposeAgents.descPh", "Descripción")}" />
                <details class="text-xs">
                  <summary class="cursor-pointer select-none text-muted-foreground">${t("proposeAgents.advanced", "Prompt y herramientas")}</summary>
                  <label class="mt-2 block text-[11px] text-muted-foreground">${t("proposeAgents.systemPrompt", "System prompt")}</label>
                  <textarea class="pag-prompt mt-1 h-28 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] leading-snug text-foreground outline-none focus:border-primary" data-idx="${i}">${escapeHtml(p.systemPrompt)}</textarea>
                  <label class="mt-2 block text-[11px] text-muted-foreground">${t("proposeAgents.tools", "Herramientas (separadas por coma; vacío = sin restricción)")}</label>
                  <input class="pag-tools mt-1 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:border-primary" data-idx="${i}" value="${escapeAttr((p.allowedTools || []).join(", "))}" />
                </details>
              </div>
            </div>
          </div>`).join("")}
      </div>`;

    const refresh = () => {
      const n = Array.from(overlay.querySelectorAll<HTMLInputElement>(".pag-cb")).filter((c) => c.checked).length;
      if (createBtn) {
        createBtn.disabled = n === 0;
        createBtn.textContent = n === 0 ? t("proposeAgents.create", "Crear agentes") : fmt(t("proposeAgents.createN", "Crear {n} agentes"), { n });
      }
    };
    refresh();
    body.addEventListener("change", refresh);

    createBtn?.addEventListener("click", async () => {
      const picks: Proposal[] = [];
      Array.from(overlay.querySelectorAll<HTMLInputElement>(".pag-cb")).forEach((cb) => {
        if (!cb.checked) return;
        const i = Number(cb.getAttribute("data-idx"));
        const base = proposals[i];
        if (!base) return;
        const name = (overlay.querySelector<HTMLInputElement>(`.pag-name[data-idx="${i}"]`)?.value || base.name).trim();
        if (!name) return;
        const providerId = overlay.querySelector<HTMLSelectElement>(`.pag-prov[data-idx="${i}"]`)?.value || base.providerId;
        const description = (overlay.querySelector<HTMLInputElement>(`.pag-desc[data-idx="${i}"]`)?.value || "").trim();
        const systemPrompt = overlay.querySelector<HTMLTextAreaElement>(`.pag-prompt[data-idx="${i}"]`)?.value ?? base.systemPrompt;
        const toolsRaw = (overlay.querySelector<HTMLInputElement>(`.pag-tools[data-idx="${i}"]`)?.value || "").trim();
        const allowedTools = toolsRaw ? toolsRaw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean) : null;
        picks.push({ name, description, systemPrompt, providerId, model: base.model || "", allowedTools, icon: base.icon, color: base.color, projectPaths: base.projectPaths });
      });
      if (picks.length === 0) return;
      if (createBtn) { createBtn.disabled = true; createBtn.innerHTML = `<i class="ti ti-loader-2 animate-spin text-sm"></i> ${t("proposeAgents.creating", "Creando…")}`; }
      let created = 0;
      const fails: string[] = [];
      for (const p of picks) {
        try {
          const res: any = await api.post("/api/ai/agents", p);
          if (res.ok) created += 1; else fails.push(`${p.name}: ${res.error || "error"}`);
        } catch (e: any) {
          fails.push(`${p.name}: ${e?.message || "error"}`);
        }
      }
      window.dispatchEvent(new CustomEvent(ASSISTANT_AGENTS_UPDATED_EVENT));
      if (created > 0) showToast(fmt(t("proposeAgents.created", "{n} agentes creados"), { n: created }), fails.length === 0);
      else showToast(fails[0] || t("proposeAgents.createFail", "No se pudieron crear los agentes"), false);
      close();
    });
  }
