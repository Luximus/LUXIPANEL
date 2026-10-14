// Mailbox inbox viewer — entry point. Splits the former monolith into cohesive
// submodules; this entry wires them (imports register their bindings + window.*
// globals + DOM event listeners as a side effect) and runs the canonical init()
// lifecycle (cooldown + astro hooks). No DataTable here, so no request-ready
// handshake.
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { accountId } from "./state";
import { loadAccountInfo, loadFolders } from "./folders";
import { loadMessages } from "./messages";
import "./credential";
import "./folder-manager";
import "./contacts";
import "./actions";

// ── Init ───────────────────────────────────────────────────
// Cooldown + lifecycle: el script type="module" solo evalúa una vez por
// pestaña; sin estos hooks una segunda visita SPA al mismo inbox quedaba
// con el DOM fresco vacío y sin re-fetch. astro:page-load + after-swap
// fire 3x por entrada, throttle de 4s los dedupea.
let initLastAt = 0;
const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
function init() {
  if (!document.getElementById("messages-list") && !document.getElementById("inbox-container")) return;
  if (!accountId) return;
  if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
  initLastAt = Date.now();
  loadAccountInfo();
  loadFolders();
  loadMessages();
}
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();
