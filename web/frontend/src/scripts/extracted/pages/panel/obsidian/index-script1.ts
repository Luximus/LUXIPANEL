import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openNote } from "./editor";
import { showToast } from "./dom";
// Obsidian page script — entry point. Splits the former 969-line monolith into
// cohesive submodules (state / dom / input-dialog / vaults / tree / editor /
// links / search / assistant / bind), wired here. This entry only runs the
// canonical init() lifecycle + cooldown; behaviour is byte-for-byte identical
// to the pre-split single file. No DataTable, no write-behind — only the shared
// lib/* URL imports stay external.
import { createModuleInit } from "/scripts/extracted/lib/script-init.js";
import { state } from "./state";
import { loadI18n } from "./dom";
import { bindOnce } from "./bind";
import { loadVaults } from "./vaults";
import { loadPreferences, resetPreferences } from "./preferences";
import { showMobilePane } from "./preview";

// ── SPA-safe init (module-eval + astro:after-swap + astro:page-load) ──────────
// F-01: el boilerplate (ancla + cooldown 4s + hooks de ciclo de vida) vive en
// `createModuleInit`. Sin DataTable → sin handshake.
createModuleInit({
  anchorId: "obs-vault-select",
  onMount: () => {
    loadI18n();
    bindOnce();
  },
  onFetch: () => {
    // The swap replaced the DOM: editor/tree state restarts from the vault list.
    state.notePath = null;
    state.dirty = false;
    state.linksOpen = false;
    state.scopeSeq++;
    state.vaultId = null;
    resetPreferences();
    showMobilePane("tree");
    // Fetch both resources now; resolve the stored selection before applying
    // the vault list so lastVaultId and editor preferences remain authoritative.
    const preferences = loadPreferences();
    const projectId = new URLSearchParams(window.location.search).get("project");
    if (projectId) {
      const scope = state.scopeSeq;
      void (async () => {
        const res = await api.post<{ vaultId: string; note: string }>(`/api/obsidian/projects/${encodeURIComponent(projectId)}/context-document`, {});
        if (scope !== state.scopeSeq) return;
        if (!res.ok || !res.data) {
          showToast(res.error ?? "No se pudo abrir el documento del proyecto", false);
          await loadVaults(undefined, preferences);
          return;
        }
        await loadVaults(res.data.vaultId, preferences);
        if (scope === state.scopeSeq && state.vaultId === res.data.vaultId) await openNote(res.data.note);
      })();
    } else void loadVaults(undefined, preferences);
  },
});
