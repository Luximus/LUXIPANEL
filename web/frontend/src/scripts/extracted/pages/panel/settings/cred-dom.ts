// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Credentials tab — shared DOM/i18n leaf helpers (toast, status badges, escaping).
// Imports NOTHING beyond the DOM; every card submodule depends on these.

// ── i18n (F-03/T-08: trío compartido, solo cambia el id del payload) ─────────
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";

export const { loadI18n, t, fmt } = createPageI18n("credentials-i18n");

// ── toast (reusa el toast global de la página de ajustes) ────────────────────
export function showToast(msg: string, ok = true) {
  const toast = document.getElementById("toast");
  const inner = document.getElementById("toast-inner");
  const icon = document.getElementById("toast-icon");
  const msgEl = document.getElementById("toast-msg");
  if (!toast || !inner || !icon || !msgEl) {
    // Fallback mínimo si el toast de la página no existe.
    console[ok ? "log" : "error"]("[credentials]", msg);
    return;
  }
  msgEl.textContent = msg;
  icon.className = `ti ${ok ? "ti-circle-check text-emerald-500" : "ti-alert-triangle text-destructive"} text-base`;
  // Mismo estilo de borde/fondo que el showToast de index-script1.ts.
  inner.className = `flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm ${
    ok ? "border-emerald-500/30 bg-card text-emerald-600" : "border-destructive/30 bg-card text-destructive"
  }`;
  toast.classList.remove("hidden");
  window.setTimeout(() => toast.classList.add("hidden"), 3500);
}

// ── estado de cada tarjeta de token ──────────────────────────────────────────
export function readField(data: unknown, field: string): unknown {
  if (!data || typeof data !== "object" || !field) return undefined;
  return (data as Record<string, unknown>)[field];
}

// ── helpers de estado (compartidos token/storage/connector) ──────────────────
export function setStatus(card: HTMLElement, ok: boolean, detail: string, okLabel?: string) {
  const okText = okLabel || t("statusSet", "Configurado");
  const missText = t("statusMissing", "Sin configurar");
  const stateEl = card.querySelector<HTMLElement>(".cred-state");
  if (stateEl) {
    stateEl.textContent = ok ? `${okText}${detail ? ` · ${detail}` : ""}` : missText;
    stateEl.classList.toggle("text-emerald-600", ok);
    stateEl.classList.toggle("text-muted-foreground", !ok);
  }
  const badge = card.querySelector<HTMLElement>(".cred-badge");
  if (badge) {
    badge.className = `cred-badge ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
      ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-border bg-muted text-muted-foreground"
    }`;
    badge.innerHTML = `<i class="ti ${ok ? "ti-circle-check" : "ti-circle-x"} text-xs"></i> ${ok ? okText : missText}`;
  }
}

// F-02: ambos escapadores eran el escapador canónico de 5 caracteres copiado.
export { escapeHtml, escapeHtml as escapeHtmlCred } from "/scripts/extracted/lib/escape.js";
