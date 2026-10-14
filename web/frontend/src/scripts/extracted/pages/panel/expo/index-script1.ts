// Expo page script — entry point. Splits the former 1902-line monolith into
// cohesive submodules (state / dom / table-bridge / account / projects / builds /
// qr / logs / store / env / bind), wired here. This entry runs the canonical
// init() lifecycle + cooldown + the DataTable REQUEST_READY handshake; behaviour
// is byte-for-byte identical to the pre-split single file.
import { createModuleInit } from "/scripts/extracted/lib/script-init.js";
import { openAlert } from "/scripts/extracted/lib/confirm.js";
import { S, EXPO_BUILDS_TABLE_ID, EXPO_STORE_TABLE_ID, EXPO_ENV_TABLE_ID } from "./state";
import { loadI18n } from "./dom";
import { bindOnce } from "./bind";
import { loadConfig } from "./account";
import { bindLiveSessions } from "./live-sessions";

// ── SPA-safe init (module-eval + astro:after-swap + astro:page-load) ──────────
// F-01: el boilerplate (ancla + cooldown 4s + hooks de ciclo de vida + handshake
// REQUEST_READY por tabla) vive en `createModuleInit`.
createModuleInit({
  anchorId: "expo-root",
  tableIds: [EXPO_BUILDS_TABLE_ID, EXPO_STORE_TABLE_ID, EXPO_ENV_TABLE_ID],
  onMount: () => {
    loadI18n();
    bindOnce();
    bindLiveSessions();
  },
  onFetch: () => {
    void loadConfig();
  },
});

// Avoid "openAlert imported but unused" — keep available for future flows.
void openAlert;
window.addEventListener("luxipanel:target-changed", () => {
  if (!document.getElementById("expo-root")) return;
  S.targetGeneration++;
  S.currentProject = null;
  S.projects = [];
  S.devSessions.clear();
  S.devPending.clear();
  S.devRevision.clear();
  S.installingPath = null;
  S.installErrorPath = null;
  S.installLog = "";
  S.account = null;
  void loadConfig();
});
