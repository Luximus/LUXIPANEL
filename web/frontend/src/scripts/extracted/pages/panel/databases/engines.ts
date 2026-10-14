// Databases page — engine detection, install offers, and the generic
// module-deps banner integration.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { runInstall } from "/scripts/extracted/lib/install-modal.js?v=1";
import { refreshModuleDeps, type ModuleDepsOptions } from "/scripts/extracted/lib/module-deps.js?v=20260609a";
import { $, esc, fmt, showToast, t } from "./dom";
import { state, type EngineInfo } from "./state";
import { loadDatabases } from "./navigation";
import { resetView } from "./views";

/** Engines the install section can provision, keyed by detected engine type. */
const INSTALLABLE: Record<EngineInfo["type"], { id: "mariadb" | "postgresql"; label: string }> = {
  mysql: { id: "mariadb", label: t("install.mariadb", "MariaDB") },
  postgresql: { id: "postgresql", label: t("install.postgresql", "PostgreSQL") },
};

// ── Engines ──────────────────────────────────────────────────────────────────
export async function loadEngines() {
  const wrap = $("db-engines");
  const installWrap = $("db-install");
  if (!wrap) return;
  const res = await api.get<EngineInfo[]>("/api/databases/engines");
  if (!res.ok) {
    wrap.innerHTML = `<p class="text-sm text-destructive">${esc(res.error ?? t("errors.detectEngines", "Error al detectar motores"))}</p>`;
    return;
  }
  const engines: EngineInfo[] = res.data ?? [];
  const running = engines.filter((e) => e.running);

  // Only RUNNING engines are shown as selectable — never disabled buttons.
  if (running.length === 0) {
    wrap.innerHTML = `<p class="text-sm text-muted-foreground">${t("empty.noEngines", "No hay ningún motor de base de datos activo en el servidor. Instala uno para empezar.")}</p>`;
  } else {
    wrap.innerHTML = running
      .map(
        (e) => `<button data-engine="${e.type}"
          class="db-engine-btn group inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent">
          <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
          <span>${esc(e.flavor ?? e.label)}</span>
          <span class="text-xs font-normal text-muted-foreground">${esc(e.version ?? t("labels.active", "Activo"))}</span>
        </button>`,
      )
      .join("");
    wrap.querySelectorAll<HTMLButtonElement>(".db-engine-btn").forEach((btn) => {
      btn.addEventListener("click", () => selectEngine(btn.dataset.engine as EngineInfo["type"]));
    });
  }

  // Install section: offer engines that aren't running on the target.
  if (installWrap) {
    const installable = engines.filter((e) => !e.running);
    installWrap.innerHTML = installable
      .map((e) => {
        const spec = INSTALLABLE[e.type];
        return `<button data-install="${spec.id}"
          class="db-install-btn inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
          <i class="ti ti-download text-sm"></i> ${fmt(t("actions.install", "Instalar {label}"), { label: esc(spec.label) })}
        </button>`;
      })
      .join("");
    installWrap.querySelectorAll<HTMLButtonElement>(".db-install-btn").forEach((btn) => {
      btn.addEventListener("click", () => void installEngine(btn.dataset.install as "mariadb" | "postgresql", btn.textContent?.trim() ?? ""));
    });
  }

  // Auto-select the first running engine (keep the current one if still valid).
  if (state.engine && running.some((e) => e.type === state.engine)) {
    highlightEngine();
  } else if (running[0]) {
    void selectEngine(running[0].type);
  } else {
    state.engine = null;
  }
}

async function installEngine(id: "mariadb" | "postgresql", label: string) {
  const res = await runInstall({
    id: "databases",
    endpoint: "/api/databases/install",
    body: { engine: id },
    runningText: fmt(t("info.installing", "Instalando {label}… puede tardar unos minutos."), { label }),
    successText: fmt(t("info.installed", "{label} instalado. Detectando el motor…"), { label }),
  });
  if (res.ok) {
    showToast(fmt(t("toasts.engineInstalled", "{label} instalado"), { label }));
    // Re-detect so the new engine shows up as running (and drop the install button).
    await loadEngines();
    // Keep the generic deps banner in sync with the freshly installed engine.
    void refreshModuleDeps(DEPS_OPTS);
  }
}

// ── Generic module deps banner (system-deps, requiresOneOf) ─────────────────
// The module keeps its own engine detector + per-engine installer
// (#db-install → POST /api/databases/install) as the primary flow. The
// generic <ModuleDepsBanner module="databases"> only takes over the
// "no engine installed at all" state: GET /api/system-deps/databases marks
// both engines `optional` with requiresOneOf, so `allRequiredInstalled` is
// true as soon as ANY engine is present. The lib handles that one-of state
// itself (candidates in the MAIN list with per-dep install buttons, main
// "Install now" hidden, one-of texts); this page-script only:
//   · onMissing (no engine): hides its own dashed install buttons
//     (#db-install) so the banner is the single install affordance.
//   · onReady (≥1 engine): shows #db-install again (it already offers the
//     missing engine — `showOptional: false` keeps the lib's optional card
//     off so the offer isn't duplicated) and, if we came from the missing
//     state, re-detects engines so the freshly installed one is selectable.
let depsWasMissing = false;

export const DEPS_OPTS: ModuleDepsOptions = {
  module: "databases",
  showOptional: false,
  onMissing: () => {
    depsWasMissing = true;
    const installWrap = $("db-install");
    installWrap?.classList.add("hidden");
    installWrap?.classList.remove("flex");
  },
  onReady: () => {
    const installWrap = $("db-install");
    installWrap?.classList.remove("hidden");
    installWrap?.classList.add("flex");
    if (depsWasMissing) {
      depsWasMissing = false;
      // An engine was just installed from the banner — re-detect engines so
      // the selector picks it up without a manual reload.
      void loadEngines();
    }
  },
};

export function highlightEngine() {
  document.querySelectorAll<HTMLButtonElement>(".db-engine-btn").forEach((b) => {
    const active = b.dataset.engine === state.engine;
    b.classList.toggle("border-primary", active);
    b.classList.toggle("ring-2", active);
    b.classList.toggle("ring-primary/20", active);
  });
}

export async function selectEngine(type: EngineInfo["type"]) {
  state.engine = type;
  state.database = null;
  state.table = null;
  highlightEngine();
  $("db-tables")!.innerHTML = `<p class="px-3 py-3 text-xs text-muted-foreground">${t("common.selectDb", "Selecciona una base de datos.")}</p>`;
  resetView();
  await loadDatabases();
}
