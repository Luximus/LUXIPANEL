// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Credentials tab — module gating, per-load orchestration (loadAll), the
// "Configurado" badge counter and the #cred-<id> deep-link highlighter.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { ADMIN_MODULES_PATH, MODULES_INSTALLED_PATH } from "@/lib/api-routes";
import { S } from "./cred-state";
import { loadTokenCard } from "./cred-token-cards";
import { loadConnectorCard, loadStorageCard } from "./cred-provider-cards";

// ── gating por módulos habilitados ───────────────────────────────────────────
// `user.modules` (JWT) es el catálogo del ROL, no los módulos habilitados del
// panel; se consulta el mismo endpoint que usa el sidebar.
async function fetchEnabledModuleIds(): Promise<Set<string> | null> {
  const collect = (rows: unknown): Set<string> | null => {
    if (!Array.isArray(rows)) return null;
    const ids = new Set<string>();
    for (const r of rows as Array<Record<string, unknown>>) {
      const id = typeof r?.id === "string" ? r.id : "";
      if (!id) continue;
      // /api/modules/installed ya viene filtrado; /api/admin/modules trae todos.
      const flagged = "enabled" in r || "installed" in r;
      if (!flagged || r.enabled === true || r.installed === true) ids.add(id);
    }
    return ids;
  };
  // /api/admin/modules → [{id, enabled}] (catálogo del panel, gated por admin).
  const primary = await api.get<unknown>(ADMIN_MODULES_PATH);
  if (primary.ok) {
    const ids = collect(primary.data);
    if (ids) return ids;
  }
  // Fallback: el endpoint que usa el sidebar (ya viene filtrado).
  const fallback = await api.get<unknown>(MODULES_INSTALLED_PATH);
  if (fallback.ok) {
    const ids = collect(fallback.data);
    if (ids) return ids;
  }
  return null; // no se pudo determinar → no ocultar nada (fail-open)
}

function gateCards(enabled: Set<string> | null): HTMLElement[] {
  const root = document.getElementById("panel-credentials");
  if (!root) return [];
  const all = Array.from(root.querySelectorAll<HTMLElement>("[data-cred-id]"));
  const visible: HTMLElement[] = [];
  for (const card of all) {
    // `data-cred-gate` = módulo que habilita la tarjeta (p.ej. storage R2/S3 se
    // gatea por "backups"); si falta, se usa el propio id.
    const id = card.dataset.credGate || card.dataset.credId || "";
    // Fail-open: si no hay lista, se muestran todas.
    const show = !enabled || id.split("|").some(moduleId => enabled.has(moduleId));
    card.classList.toggle("hidden", !show);
    if (show) visible.push(card);
  }
  const empty = document.getElementById("cred-empty");
  if (empty) empty.classList.toggle("hidden", visible.length > 0);
  return visible;
}

// Cuenta de tarjetas "Configurado" en el panel #panel-credentials. Se actualiza
// desde cada apply*State y se refleja en el badge del tab (settings).
let credConfiguredCount = 0;
function bumpCredBadge() {
  const badge = document.getElementById("tab-credentials-count");
  if (badge) badge.textContent = String(credConfiguredCount);
  (window as any).__lxpCredentialsConfigured = credConfiguredCount;
}

/** Tras pintar el badge de una tarjeta, pregunta al DOM si quedó "Configurado"
 *  y suma al contador global. Robustos a cambios visuales del badge. */
function countFromCard(card: HTMLElement) {
  const badge = card.querySelector<HTMLElement>(".cred-badge");
  // emerald-500 (en connector.status-icon) o emerald-600 (en token stateEl/badge)
  const configured =
    (badge?.classList.contains("text-emerald-600") ?? false) ||
    (badge?.classList.contains("border-emerald-500/30") ?? false) ||
    // Conector: su tarjeta usa "ti-circle-check text-emerald-500" en el icono
    Boolean(card.querySelector(".ti-circle-check.text-emerald-500"));
  if (configured) credConfiguredCount += 1;
}

export async function loadAll() {
  const root = document.getElementById("panel-credentials");
  if (!root) return;
  // Refresca cachés por carga (datos pueden haber cambiado entre navegaciones).
  S.providerCredsCache = null;
  S.connectorsCache = null;
  credConfiguredCount = 0;
  const batch = await api.get<{ enabledModules: string[]; statuses: Record<string, unknown> }>("/api/settings/connector-status");
  const snapshot = batch.ok ? batch.data : null;
  const enabled = snapshot ? new Set(snapshot.enabledModules) : await fetchEnabledModuleIds();
  if (snapshot) {
    S.providerCredsCache = snapshot.statuses["/api/backups/provider-creds"] as typeof S.providerCredsCache ?? null;
    S.connectorsCache = (snapshot.statuses["/api/ai/connectors"] as { connectors?: typeof S.connectorsCache })?.connectors ?? null;
  }
  const visible = gateCards(enabled);
  await Promise.all(
    visible.map(async (card) => {
      if (card.hasAttribute("data-cred-card")) await loadTokenCard(card, snapshot?.statuses[card.dataset.credBase ?? ""] as Record<string, unknown> | undefined);
      else if (card.hasAttribute("data-cred-storage")) await loadStorageCard(card);
      else if (card.hasAttribute("data-cred-connector")) await loadConnectorCard(card);
      countFromCard(card);
    }),
  );
  bumpCredBadge();
}

export function highlightDeepLink() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith("#cred")) return;
  // #cred-<id>  ó  #credentials
  const id = hash.startsWith("#cred-") ? (hash === "#cred-git" ? "repository-store" : hash.slice("#cred-".length)) : "";
  if (!id) return;
  const card = document.getElementById(`cred-card-${id}`);
  if (!card || card.classList.contains("hidden")) return; // no enfocar tarjetas ocultas por gating
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
  window.setTimeout(() => {
    card.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
  }, 2400);
  const input = card.querySelector<HTMLInputElement>(".cred-input");
  input?.focus();
}
