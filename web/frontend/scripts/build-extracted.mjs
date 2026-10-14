import "./build-font-assets.mjs";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

execFileSync(process.execPath, [path.join(root, "scripts/build-tabler-svg-icons.mjs")], { stdio: "inherit" });

// Regenera los iconos de archivo (offline) del módulo `files` antes de empaquetar.
execFileSync(process.execPath, [path.join(root, "scripts/build-file-icons.mjs")], {
  stdio: "inherit",
});

// Regenera los iconos de marca (offline) de los proveedores del Asistente IA.
execFileSync(process.execPath, [path.join(root, "scripts/build-provider-icons.mjs")], {
  stdio: "inherit",
});

// Regenera los logos de marca (offline) de los módulos con marca propia
// (nginx/cloudflare/obsidian) usados por el tab Módulos del asistente.
execFileSync(process.execPath, [path.join(root, "scripts/build-module-icons.mjs")], {
  stdio: "inherit",
});

const assetLoaders = {
  ".ttf": "file",
  ".woff": "file",
  ".woff2": "file",
  ".eot": "file",
  ".otf": "file",
};

const entries = [
  { entry: "src/lib/table-pages.ts", outfile: "public/scripts/extracted/lib/table-pages.js", bundle: true, target: "es2022" },
  {
    entry: "src/scripts/reactbits-controls.ts",
    outfile: "public/scripts/reactbits-controls.20261004-1.js",
    bundle: true,
    minify: true,
    target: "es2022",
    banner: { js: "/*!\n" + readFileSync(path.join(root, "src/components/reactbits-controls/LICENSE.md"), "utf8") + "\n*/" },
  },
  {entry:"src/lib/startup-state.ts",outfile:"public/scripts/extracted/lib/startup-state.js",bundle:true,target:"es2022"},
  {entry:"src/lib/spa-ready.ts",outfile:"public/scripts/extracted/lib/spa-ready.js",bundle:true,target:"es2022"},
  { entry: "src/lib/chat-event-stream.ts", outfile: "public/scripts/extracted/lib/chat-event-stream.js", bundle: true, target: "es2022" },
  { entry: "src/lib/notification-event-stream.ts", outfile: "public/scripts/extracted/lib/notification-event-stream.js", bundle: true, external: ["/scripts/*"], target: "es2022" },
  { entry: "src/scripts/extracted/lib/permission-editor.ts", outfile: "public/scripts/extracted/lib/permission-editor.js", bundle: true, external: ["/scripts/extracted/lib/*"], target: "es2022" },
  { entry: "src/scripts/extracted/pages/panel/hosting/provider-settings.ts", outfile: "public/scripts/extracted/pages/panel/hosting/provider-settings.js", bundle: true, external: ["/scripts/extracted/lib/*"], target: "es2020" },
  {
    entry: "src/scripts/extracted/lib/mail-job-poll.ts",
    outfile: "public/scripts/extracted/lib/mail-job-poll.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/lib/mail-sudo.ts",
    outfile: "public/scripts/extracted/lib/mail-sudo.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/lib/mail-api-client.ts",
    outfile: "public/scripts/extracted/lib/mail-api-client.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/lib/mail-server-settings.ts",
    outfile: "public/scripts/extracted/lib/mail-server-settings.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/lib/logout.ts",
    outfile: "public/scripts/extracted/lib/logout.js",
    target: "es2020",
  },
  {
    // ReactBits-inspired UI/UX kit (SpotlightCard glow, ClickSpark, CountUp).
    // Dependency-free; wired globally from PanelLayout. Standalone bundle.
    entry: "src/lib/reactbits-kit.ts",
    outfile: "public/scripts/extracted/lib/reactbits-kit.js",
    bundle: true,
  },
  {
    entry: "src/scripts/qrcode-browser.ts",
    outfile: "public/scripts/extracted/vendor/qrcode-browser.js",
    bundle: true,
    target: "es2020",
  },
  {
    // Self-hosted Quill rich-text editor (vendor bundle). Emits quill.js +
    // quill.css; imported by URL from the mail inbox inline composer.
    entry: "src/scripts/extracted/vendor/quill.ts",
    outfile: "public/scripts/extracted/vendor/quill.js",
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2020",
  },
  {
    // Self-hosted Markdown renderer (vendor bundle). Emits markdown.js;
    // imported by URL wherever the panel renders markdown content.
    entry: "src/scripts/extracted/vendor/markdown.ts",
    outfile: "public/scripts/extracted/vendor/markdown.js",
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2020",
  },
  {
    // Self-hosted flatpickr date picker (vendor bundle). Emits flatpickr.js +
    // flatpickr.css; imported by URL from the mail inbox date-range filter.
    entry: "src/scripts/extracted/vendor/flatpickr.ts",
    outfile: "public/scripts/extracted/vendor/flatpickr.js",
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2020",
  },
  {
    // Shared write-behind job poller imported by every queue-backed page
    // script (mail, users, nginx, firewall, cron). Standalone (no imports).
    entry: "src/lib/job-poll.ts",
    outfile: "public/scripts/extracted/lib/job-poll.js",
    target: "es2020",
  },
  {
    // Bridge contrato unificado de solicitudes externas al Asistente IA
    // (Monitor "Optimizar disco con IA", Mail "Depurar con IA", Obsidian
    // "Preparar para IA", …). FIFO + dedupe por requestId, idempotente.
    // Standalone (sin imports de React/UI) para uso desde page scripts.
    entry: "src/lib/assistant-request.ts",
    outfile: "public/scripts/extracted/lib/assistant-request.js",
    target: "es2020",
  },
  {
    // API client (fetch wrapper) importado por las page scripts vía la URL de
    // runtime `/scripts/extracted/lib/api-client.js` (queda external en ellas).
    // DEBE construirse aquí o las páginas sirven un .js stale (trampa conocida
    // de scripts extraídos). Inyecta el header X-Bridge-Session-Id por pestaña.
    // Desde el refactor DRY (2026-08-21) importa `@/lib/prefs-store` (helpers
    // puros de localStorage, sin imports), así que DEBE empaquetarse: con
    // bundle:false el .js servido conservaba `from "@/lib/prefs-store"` y el
    // navegador fallaba con "Failed to resolve module specifier" → api-client
    // muerto en TODO el panel (Ajustes en esqueleto, etc.).
    entry: "src/lib/api-client.ts",
    outfile: "public/scripts/extracted/lib/api-client.js",
    bundle: true,
    target: "es2020",
  },
  { entry: "src/lib/live-data.ts", outfile: "public/scripts/extracted/lib/live-data.js", bundle: true, target: "es2020" },
  {
    // SSOT for the `lxp:data-table:*` CustomEvent vocabulary, imported by URL
    // from every DataTable-backed page script. Standalone (no imports). MUST be
    // listed here or pages import a missing module.
    entry: "src/lib/datatable-events.ts",
    outfile: "public/scripts/extracted/lib/datatable-events.js",
    target: "es2020",
  },
  {
    // SSOT for the extracted-script init cooldown (4s) + `createModuleInit()`,
    // the canonical init/cooldown/lifecycle boilerplate (F-01). Imported by URL
    // from the page scripts. Standalone (no imports).
    entry: "src/lib/script-init.ts",
    outfile: "public/scripts/extracted/lib/script-init.js",
    target: "es2020",
  },
  {
    entry: "src/lib/scoped-preferences.ts",
    outfile: "public/scripts/extracted/lib/scoped-preferences.js",
    target: "es2020",
  },
  {
    // Shared bottom-right toast (F-04) — replaces the 27 per-script copies of
    // `showToast(msg, ok)`. Imported by URL from the page scripts
    // (`/scripts/extracted/lib/toast.js`). Standalone (no imports). MUST be
    // listed here or the pages import a missing module.
    entry: "src/lib/toast.ts",
    outfile: "public/scripts/extracted/lib/toast.js",
    target: "es2020",
  },
  {
    // `createPageI18n(elementId)` → { loadI18n, t, fmt } (F-03 / T-08) — the trio
    // that was copied byte for byte into 26 page scripts. Imported by URL
    // (`/scripts/extracted/lib/page-i18n.js`). Standalone (no imports). MUST be
    // listed here or the pages import a missing module.
    entry: "src/lib/page-i18n.ts",
    outfile: "public/scripts/extracted/lib/page-i18n.js",
    target: "es2020",
  },
  {
    // Byte/duration/token/date formatters (T-07 / E-05) shared by the page
    // scripts via `/scripts/extracted/lib/format.js`. Standalone (no imports).
    entry: "src/lib/format.ts",
    outfile: "public/scripts/extracted/lib/format.js",
    target: "es2020",
  },
  {
    // Canonical API endpoint paths (SSOT) shared by the page scripts via
    // `/scripts/extracted/lib/api-routes.js` (stays external in the bundled
    // pages). Also imported by React/Astro + bundle:true entries via
    // `@/lib/api-routes` (inlined there). Standalone (no imports). MUST be
    // listed here or the pages import a missing module.
    entry: "src/lib/api-routes.ts",
    outfile: "public/scripts/extracted/lib/api-routes.js",
    target: "es2020",
  },
  {
    // Canonical panel CustomEvent names (SSOT) shared by the page scripts via
    // `/scripts/extracted/lib/panel-events.js` (stays external in the bundled
    // pages). Also imported by React/Astro via `@/lib/panel-events` (inlined
    // there). Standalone (no imports). MUST be listed here or the pages import
    // a missing module.
    entry: "src/lib/panel-events.ts",
    outfile: "public/scripts/extracted/lib/panel-events.js",
    target: "es2020",
  },
  {
    // SSOT for the branding/live-theme sessionStorage keys + live-CSS schema
    // version, shared by the `bundle:false` extracted scripts (branding-runtime,
    // tornasol-animation) and the settings bundle via
    // `/scripts/extracted/lib/branding-storage-keys.js` (stays external). Also
    // imported by React/Astro via `@/lib/branding-storage-keys`. Standalone (no
    // imports). MUST be listed here or the scripts import a missing module.
    entry: "src/lib/branding-storage-keys.ts",
    outfile: "public/scripts/extracted/lib/branding-storage-keys.js",
    target: "es2020",
  },
  {
    // `$()` / `openDialog()` / `closeDialog()` (E-06 / E-10) — the DOM lookups
    // and the three divergent `<dialog>.showModal()` guards the page scripts had
    // copied ~50 times. Standalone (no imports).
    entry: "src/scripts/extracted/lib/dom.ts",
    outfile: "public/scripts/extracted/lib/dom.js",
    target: "es2020",
  },
  {
    // `tsOf()` (E-05) — the "parse anything into a sortable epoch" helper the
    // sorters had copied verbatim. Standalone (no imports).
    entry: "src/scripts/extracted/lib/time.ts",
    outfile: "public/scripts/extracted/lib/time.js",
    target: "es2020",
  },
  {
    // Tab-state helpers (E-03) — the three cloned families of `classList.toggle`
    // with verbatim Tailwind literals. Standalone (no imports).
    entry: "src/scripts/extracted/lib/tabs.ts",
    outfile: "public/scripts/extracted/lib/tabs.js",
    target: "es2020",
  },
  {
    // `confirmMutateReload()` (E-04) — the "confirm → mutate → toast → awaitJob →
    // reload" CRUD handler copied into ~12 modules. Imports confirm/toast/
    // job-poll by URL (left external, not bundled).
    entry: "src/scripts/extracted/lib/crud.ts",
    outfile: "public/scripts/extracted/lib/crud.js",
    target: "es2020",
  },
  {
    // Single source of truth for the `lxp:assistant:request v1` contract
    // (Monitor / Mail / Files / Obsidian / Settings → Assistant handoff).
    // Importado por URL desde los page scripts que despachan prompts
    // contextuales. Standalone (sin imports de React/UI). DEBE estar listado
    // aquí o los productores sirven un .js stale y el puente se rompe.
    entry: "src/lib/assistant-request.ts",
    outfile: "public/scripts/extracted/lib/assistant-request.js",
    target: "es2020",
  },
  {
    // Modal helpers (openConfirm / openAlert / openPrompt) used by the extracted
    // page scripts via the runtime URL `/scripts/extracted/lib/confirm.js`.
    // Bundled standalone from the single source of truth `src/lib/confirm.ts`
    // (also imported by React/Astro via `@/lib/confirm`). `bundle:true` inlines
    // the React-free body-pointer-events core — no React ends up in this bundle.
    entry: "src/lib/confirm.ts",
    outfile: "public/scripts/extracted/lib/confirm.js",
    bundle: true,
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/lib/i18n-client.ts",
    outfile: "public/scripts/extracted/lib/i18n-client.js",
    target: "es2020",
  },
  {
    // Shared HTML-escaping helper (escapeHtml / escapeAttr) imported by URL from
    // the page scripts to close raw `${…}` → innerHTML XSS. Standalone (no
    // imports); stays external in bundled entries via the lib/* glob.
    entry: "src/scripts/extracted/lib/escape.ts",
    outfile: "public/scripts/extracted/lib/escape.js",
    target: "es2020",
  },
  {
    // Logos de marca de módulos (simple-icons, offline; generado por
    // build-module-icons.mjs). Importado por runtime URL absoluta desde el
    // sidebar (PanelLayout-define-vars-script1) y el catálogo
    // (modules/index-script1). Standalone (sin imports).
    entry: "src/scripts/extracted/lib/module-icons.generated.ts",
    outfile: "public/scripts/extracted/lib/module-icons.generated.js",
    target: "es2020",
  },
  {
    // Puente web → app nativa (React Native WebView): notifica al contenedor
    // nativo los cambios de tema/idioma. Importado por URL desde los scripts
    // de PanelLayout y login (queda external al no bundlear). Standalone.
    entry: "src/scripts/extracted/lib/native-bridge.ts",
    outfile: "public/scripts/extracted/lib/native-bridge.js",
    target: "es2020",
  },
  {
    // Shared driver for <InstallModal> — opens the modal, POSTs to a module's
    // install endpoint, renders the package-manager log and routes sudo via
    // withSudo. Imports api-client + sudo by URL (left external, not bundled).
    entry: "src/scripts/extracted/lib/install-modal.ts",
    outfile: "public/scripts/extracted/lib/install-modal.js",
    target: "es2020",
  },
  {
    // Shared driver for <ModuleDepsBanner> — checks /api/system-deps/:module,
    // fills the "components not detected" banner and routes installs through
    // the shared install modal. Imports api-client + install-modal by URL
    // (left external, not bundled).
    entry: "src/scripts/extracted/lib/module-deps.ts",
    outfile: "public/scripts/extracted/lib/module-deps.js",
    target: "es2020",
  },
  {
    // Script de la página de login (/login). Importa getClientMessages por URL
    // (queda external al no bundlear). DEBE estar listado o se sirve el .js
    // comprometido viejo y los cambios del .ts no llegan (toggle de tema,
    // selector de idioma, etc.).
    entry: "src/scripts/extracted/pages/login-define-vars-script1.ts",
    outfile: "public/scripts/extracted/pages/login-define-vars-script1.js",
    target: "es2020",
  },
  {
    // Pure theme-CSS builder shared with the SSR runtime (layout-context).
    // Imported by the settings page (live preview) and the branding runtime
    // (persisted re-apply across SPA navigation). Bundle its shared Luxisoft
    // palette dependency so the browser does not request an unpublished module.
    entry: "src/lib/layout-branding.ts",
    outfile: "public/scripts/extracted/lib/layout-branding.js",
    target: "es2020",
    bundle: true,
  },
  {
    // Pure-data login-effect registry (react-bits backgrounds). Shared by the
    // SSR runtime (AuthLayout / settings page) and the settings client script
    // (defaults / element ids / panel show-hide). Since the SSOT refactor the
    // registry imports `./effects/*` (one pure-data module per effect), so it
    // MUST be bundled: with bundle:false esbuild kept `import … from "./effects"`
    // verbatim → the browser requested `/scripts/extracted/lib/effects` → 404 →
    // the whole settings module graph (index-script1 → fields → registry)
    // failed to evaluate and Ajustes stayed on its skeleton forever.
    entry: "src/lib/login-effects/registry.ts",
    outfile: "public/scripts/extracted/lib/login-effects-registry.js",
    bundle: true,
    target: "es2020",
  },
  {
    entry: "src/lib/panel-files-monaco.ts",
    outfile: "public/scripts/extracted/pages/panel/files/panel-files-monaco.js",
    bundle: true,
    target: "es2020",
    loader: assetLoaders,
  },
  {
    // Datos de iconos de archivo (vscode-icons, offline). Importado por
    // runtime URL absoluta desde index-script1 (no se empaqueta dentro).
    entry: "src/scripts/extracted/pages/panel/files/file-icons.generated.ts",
    outfile: "public/scripts/extracted/pages/panel/files/file-icons.generated.js",
    target: "es2020",
  },
  {
    // Split into cohesive submodules under files/ (state/paths/listing/editor/
    // git/tools/…). Bundled so the relative `./submódulo` imports resolve into
    // one output; the shared lib URL imports stay external AND — crucially — the
    // two sibling modules imported by ABSOLUTE URL (panel-files-monaco.js: heavy
    // Monaco; file-icons.generated.js: 154 KB) must ALSO be external, or esbuild
    // inlines them (MB output). Same external pattern as cron/monitor-charts
    // plus the files/* sibling glob.
    entry: "src/scripts/extracted/pages/panel/files/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/files/index-script1.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*", "/scripts/extracted/pages/panel/files/*"],
  },
  {
    entry: "src/scripts/extracted/pages/panel/settings/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/settings/index-script1.js",
    target: "es2020",
    // Split into cohesive submodules under settings/ (state/dom/tabs/layout-*/
    // security/…). Bundled so the relative `./submódulo` imports resolve into one
    // output; the shared lib URL imports stay external AND — crucially — the two
    // sibling modules imported by ABSOLUTE URL from OUTSIDE lib/ (tornasol under
    // layouts/, qrcode-browser under vendor/) must ALSO be external, or esbuild
    // inlines them. Hence three external globs (like files/*, but lib+layouts+vendor).
    bundle: true,
    external: ["/scripts/extracted/lib/*", "/scripts/extracted/layouts/*", "/scripts/extracted/vendor/*"],
  },
  {
    entry: "src/scripts/extracted/pages/panel/settings/modules-cache.ts",
    outfile: "public/scripts/extracted/pages/panel/settings/modules-cache.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/settings/credentials-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/settings/credentials-script1.js",
    target: "es2020",
    // Split into cohesive submodules under settings/ (cred-state/cred-dom/
    // cred-*-cards/cred-bindings/cred-gating/cred-git*). Bundled so the relative
    // `./cred-*` imports resolve into one output; ALL URL imports live under
    // lib/ (api-client, confirm, assistant-request), so a single external glob
    // keeps them out of the bundle.
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  {
    // Tab "Servidores": bóveda SSH única (CRUD + TOFU) contra /api/servers.
    entry: "src/scripts/extracted/pages/panel/settings/servers-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/settings/servers-script1.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/components/floating-terminal/floating-terminal.ts",
    outfile: "public/scripts/extracted/components/floating-terminal/floating-terminal.js",
    bundle: true,
    external: ["/scripts/extracted/components/floating-terminal/terminal-monaco.js*"],
    target: "es2022",
    loader: assetLoaders,
  },
  {
    entry: "src/scripts/extracted/components/floating-terminal/editor-monaco.ts",
    outfile: "public/scripts/extracted/components/floating-terminal/terminal-monaco.js",
    bundle: true,
    target: "es2022",
    loader: assetLoaders,
  },
  {
    entry: "src/scripts/extracted/theme-init.ts",
    outfile: "public/scripts/extracted/theme-init.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/layouts/google-analytics.ts",
    outfile: "public/scripts/extracted/layouts/google-analytics.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/layouts/branding-runtime.ts",
    outfile: "public/scripts/extracted/layouts/branding-runtime.js",
    target: "es2020",
  },
  {
    entry: "src/lib/branding-images.ts",
    outfile: "public/scripts/extracted/lib/branding-images.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/layouts/tornasol-animation.ts",
    outfile: "public/scripts/extracted/layouts/tornasol-animation.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/layouts/server-switcher.ts",
    outfile: "public/scripts/extracted/layouts/server-switcher.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/layouts/server-clock.ts",
    outfile: "public/scripts/extracted/layouts/server-clock.js",
    target: "es2020",
  },
  {
    // Campana de mensajes del topbar (dropdown + SSE + beep/notificación de
    // escritorio según `lxp.chat.prefs`). Standalone (sin imports).
    entry: "src/scripts/extracted/layouts/chat.ts",
    outfile: "public/scripts/extracted/layouts/chat.js",
    target: "es2020",
  },
  {
    // Cierre animado centralizado de los <dialog> nativos (parche de
    // HTMLDialogElement.prototype.close + Escape). Standalone (no imports).
    entry: "src/scripts/extracted/layouts/dialog-motion.ts",
    outfile: "public/scripts/extracted/layouts/dialog-motion.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/layouts/notifications.js",
    outfile: "public/scripts/extracted/layouts/notifications.js",
    target: "es2022",
  },
  {
    // Catálogo SSOT del super buscador (vistas/tabs/secciones/acciones). Lib
    // runtime standalone (sin imports) importada por URL desde super-search.
    entry: "src/lib/search-catalog.ts",
    outfile: "public/scripts/extracted/lib/search-catalog.js",
    target: "es2020",
  },
  {
    // Destino navegable + validación fail-closed compartida por el super
    // buscador y las notificaciones (`window.__lxpNavigate`). Lib runtime
    // standalone (sin imports) importada por URL.
    entry: "src/lib/search-target.ts",
    outfile: "public/scripts/extracted/lib/search-target.js",
    target: "es2020",
  },
  {
    // Super buscador del navbar (drawer derecho + ranking + fallback IA +
    // deep-links). Importa libs por URL (external, no se empaqueta).
    entry: "src/scripts/extracted/layouts/super-search.ts",
    outfile: "public/scripts/extracted/layouts/super-search.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/layouts/PanelLayout-define-vars-script1.ts",
    outfile: "public/scripts/extracted/layouts/PanelLayout-define-vars-script1.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/layouts/workspace-module-nav.ts",
    outfile: "public/scripts/extracted/layouts/workspace-module-nav.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/layouts/module-asset-prefetch.ts",
    outfile: "public/scripts/extracted/layouts/module-asset-prefetch.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/layouts/module-ai-footer.ts",
    outfile: "public/scripts/extracted/layouts/module-ai-footer.js",
    bundle: true,
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/modules/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/modules/index-script1.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/components/ui/view-settings-modal.ts",
    outfile: "public/scripts/extracted/components/ui/view-settings-modal.js",
    target: "es2020",
  },
  {
    // Split into cohesive submodules (state / dom / table-bridge / assistant /
    // forwards / filters / contacts-calendars / accounts / disk-clone / domains /
    // spam / tracking / settings) wired by this entry. `bundle:true` inlines the
    // siblings into one output; the shared lib URL imports stay external.
    entry: "src/scripts/extracted/pages/panel/mail/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/mail/index-script1.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  {
    entry: "src/scripts/extracted/pages/panel/nginx/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/nginx/index-script1.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/repository-store/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/repository-store/index-script1.js",
    target: "es2020",
  },
  {
    // Split into cohesive submodules under backups/ (dom / types / settings /
    // path-browser / sources / history / dialogs / storage) wired by this entry.
    // The former top-level control bindings run once at module eval via each
    // submodule's `bind*`, called in source order by the entry. `bundle:true`
    // inlines the relative `./submódulo` imports into one output; the shared lib
    // URL imports (api-client / confirm / module-deps / datatable-events /
    // script-init / escape) stay external. DataTable-backed, no write-behind, no
    // vendor/sibling URL imports → single lib/* external glob (same pattern as
    // cron/cloudflare/module-dev/databases).
    entry: "src/scripts/extracted/pages/panel/backups/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/backups/index-script1.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  {
    // Split into cohesive submodules under cron/ (dom/jobs/agents/presets/…).
    // Bundled so the relative `./submódulo` imports resolve into one output; the
    // shared lib URL imports (/scripts/extracted/lib/*) stay external (not
    // inlined), same as monitor/charts.
    entry: "src/scripts/extracted/pages/panel/cron/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/cron/index-script1.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  {
    // Split into cohesive submodules under cloudflare/ (state / dom / table-bridge /
    // config / zones / tabs / dns / cache / settings / access / deep-links / bind)
    // wired by this entry. `bundle:true` inlines the relative `./submódulo` imports
    // into one output; the shared lib URL imports (api-client / confirm /
    // datatable-events / script-init) stay external. DataTable-backed, no
    // write-behind, no vendor/sibling URL imports → single lib/* external glob
    // (same pattern as cron/users/monitor-charts).
    entry: "src/scripts/extracted/pages/panel/cloudflare/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/cloudflare/index-script1.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  {
    entry: "src/scripts/extracted/pages/panel/server-alerts/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/server-alerts/index-script1.js",
    target: "es2020",
  },
  {
    // Split into cohesive submodules under databases/ (dom / state / table-bridge /
    // engines / navigation / views / record-editor / export-dialog / sql-console /
    // bind) wired by this entry. `bundle:true` inlines the relative `./submódulo`
    // imports into one output; the shared lib URL imports (api-client / confirm /
    // install-modal / module-deps / datatable-events / script-init) stay external.
    // DataTable-backed, no write-behind, no vendor/sibling URL imports → single
    // lib/* external glob (same pattern as cron/cloudflare/module-dev).
    entry: "src/scripts/extracted/pages/panel/databases/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/databases/index-script1.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  {
    // Split into cohesive submodules under expo/ (state/dom/table-bridge/account/
    // projects/builds/qr/logs/store/env/bind) wired by this entry. `bundle:true`
    // inlines the relative `./submódulo` imports into one output; the shared lib
    // URL imports stay external AND — crucially — qrcode-browser is imported by
    // ABSOLUTE URL from vendor/ (NOT lib/), so BOTH globs must be external or
    // esbuild inlines the QR vendor bundle. Same pattern as settings/* (lib+vendor).
    entry: "src/scripts/extracted/pages/panel/expo/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/expo/index-script1.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*", "/scripts/extracted/vendor/*"],
  },
  {
    // Split into cohesive submodules under obsidian/ (state / dom / input-dialog /
    // vaults / tree / editor / links / search / assistant / bind) wired by this
    // entry. `bundle:true` inlines the relative `./submódulo` imports into one
    // output; the only URL imports are shared libs (api-client / confirm /
    // assistant-request / script-init) which stay external. No DataTable, no
    // write-behind; shared lib and Markdown vendor URL imports stay external.
    entry: "src/scripts/extracted/pages/panel/obsidian/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/obsidian/index-script1.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*", "/scripts/extracted/vendor/*"],
  },
  {
    // Split into cohesive submodules under module-dev/ (state / dom / data /
    // render / table-bridge / assistant / pr / confirm-dialog / checks / detail /
    // actions) wired by this entry. `bundle:true` inlines the relative
    // `./submódulo` imports into one output; the shared lib URL imports
    // (api-client / confirm / datatable-events / assistant-request / script-init)
    // stay external. DataTable-backed, no write-behind, no vendor/sibling URL
    // imports → single lib/* external glob (same pattern as cron/users/cloudflare).
    entry: "src/scripts/extracted/pages/panel/module-dev/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/module-dev/index-script1.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  {
    entry: "src/scripts/extracted/pages/panel/project-map/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/project-map/index-script1.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  {
    entry: "src/scripts/extracted/pages/panel/codebase-graph/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/codebase-graph/index-script1.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/firewall/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/firewall/index-script1.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/bitninja/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/bitninja/index-script1.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/hosting/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/hosting/index-script1.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/monitor/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/monitor/index-script1.js",
    target: "es2020",
  },
  {
    // Bundles Chart.js inline for the monitor history + comparison charts and
    // the doughnut/polar breakdowns. Shared lib URL imports stay external.
    entry: "src/scripts/extracted/pages/panel/monitor/charts.ts",
    outfile: "public/scripts/extracted/pages/panel/monitor/charts.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  {
    entry: "src/scripts/extracted/pages/panel/monitor/monitor-prefs.ts",
    outfile: "public/scripts/extracted/pages/panel/monitor/monitor-prefs.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/monitor/settings.ts",
    outfile: "public/scripts/extracted/pages/panel/monitor/settings.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  {
    entry: "src/scripts/extracted/pages/panel/monitor/watchdog.ts",
    outfile: "public/scripts/extracted/pages/panel/monitor/watchdog.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/preferences/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/preferences/index-script1.js",
    target: "es2020",
  },
  {
    // Split into cohesive submodules under users/ (dom/state/table-bridge/
    // role-permissions/groups/…). Bundled so the relative `./submódulo` imports
    // resolve into one output; the shared lib URL imports
    // (/scripts/extracted/lib/*) stay external (not inlined), same as cron/
    // monitor-charts.
    entry: "src/scripts/extracted/pages/panel/users/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/users/index-script1.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  {
    entry: "src/scripts/extracted/pages/panel/webhooks/index-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/webhooks/index-script1.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/mail/compose-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/mail/compose-script1.js",
    target: "es2020",
  },
  {
    // Mailbox inbox viewer — entry that wires the cohesive submodules (state /
    // helpers / status-render / folders / messages / credential / folder-manager
    // / contacts / actions) via relative imports. `bundle:true` inlines the
    // siblings into one output; the only URL imports are shared libs
    // (api-client / confirm / script-init) which stay external. No DataTable,
    // no write-behind, no vendor/sibling URL imports → single lib/* external glob.
    entry: "src/scripts/extracted/pages/panel/mail/[id]/inbox-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/mail/[id]/inbox-script1b.js",
    target: "es2020",
    bundle: true,
    external: ["/scripts/extracted/lib/*"],
  },
  // Script compartido por BaseLayout y AuthLayout. Standalone (sin imports).
  {
    entry: "src/scripts/extracted/layouts/BaseLayout-script1.ts",
    outfile: "public/scripts/extracted/layouts/BaseLayout-script1.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/docs/hosting-api-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/docs/hosting-api-script1.js",
    target: "es2020",
  },
  {
    entry: "src/scripts/extracted/pages/panel/repository-store/[owner]/[repo]-define-vars-script1.ts",
    outfile: "public/scripts/extracted/pages/panel/repository-store/[owner]/[repo]-define-vars-script1.js",
    target: "es2020",
  },
];

for (const item of entries) {
  await build({
    entryPoints: [path.join(root, item.entry)],
    outfile: path.join(root, item.outfile),
    bundle: item.bundle ?? false,
    minify: item.minify ?? false,
    // Compact production scripts while preserving application identifiers.
    // Vendor entries that already request full minification keep that behavior.
    minifyWhitespace: true,
    minifySyntax: true,
    external: item.external,
    platform: "browser",
    target: item.target,
    format: "esm",
    loader: item.loader,
    logLevel: "info",
    banner: item.banner,
    tsconfig: path.join(root, "tsconfig.json"),
  });
}
