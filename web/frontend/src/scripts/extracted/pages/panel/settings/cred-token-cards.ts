// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Credentials tab — generic token/API-key cards (Cloudflare, Expo, OpenClaw,
// GitHub repo-store) + managed cards (Asistente IA / Backups "Administrar").
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { readField, showToast, t } from "./cred-dom";

function applyTokenState(card: HTMLElement, isSet: boolean, preview: string) {
  const stateEl = card.querySelector<HTMLElement>(".cred-state");
  if (stateEl) {
    stateEl.textContent = isSet
      ? `${t("statusSet", "Configurado")}${preview ? ` · ${preview}` : ""}`
      : t("statusMissing", "Sin configurar");
    stateEl.classList.toggle("text-emerald-600", isSet);
    stateEl.classList.toggle("text-muted-foreground", !isSet);
  }
  const badge = card.querySelector<HTMLElement>(".cred-badge");
  if (badge) {
    badge.className = `cred-badge ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
      isSet
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
        : "border-border bg-muted text-muted-foreground"
    }`;
    badge.innerHTML = `<i class="ti ${isSet ? "ti-circle-check" : "ti-circle-x"} text-xs"></i> ${
      isSet ? t("statusSet", "Configurado") : t("statusMissing", "Sin configurar")
    }`;
  }
  const clearBtn = card.querySelector<HTMLButtonElement>(".cred-clear");
  if (clearBtn) {
    clearBtn.classList.toggle("hidden", !isSet);
    clearBtn.classList.toggle("inline-flex", isSet);
  }
}

export async function loadTokenCard(card: HTMLElement, snapshot?: Record<string, unknown>) {
  const base = card.dataset.credBase;
  if (!base) return;
  const setField = card.dataset.credSetField ?? "tokenSet";
  const previewField = card.dataset.credPreviewField ?? "tokenPreview";
  const res = snapshot ? { ok: true, data: snapshot } : await api.get<Record<string, unknown>>(base);
  if (!res.ok) {
    // No tumbar todo el tab por un módulo: marca como desconocido y sigue.
    applyTokenState(card, false, "");
    return;
  }
  const isSet = Boolean(readField(res.data, setField));
  const preview = String(readField(res.data, previewField) ?? "");
  applyTokenState(card, isSet, preview);
  // Campo extra OPCIONAL del contrato genérico (p.ej. ElevenLabs → Voice ID
  // por defecto): se rellena con el valor que devuelve el propio GET.
  const extra = card.querySelector<HTMLInputElement>(".cred-extra");
  if (extra) extra.value = String(readField(res.data, extra.dataset.credExtraGet ?? "") ?? "");
  // Nota viva opcional (`data-cred-note-get`): un resumen legible que devuelve
  // el propio GET — hoy el plan de Tolqia y sus límites. Sin valor, se oculta.
  const note = card.querySelector<HTMLElement>(".cred-note");
  if (note) {
    const text = String(readField(res.data, note.dataset.credNoteGet ?? "") ?? "");
    note.textContent = text;
    note.classList.toggle("hidden", !text);
  }
}

export async function saveTokenCard(card: HTMLElement) {
  const base = card.dataset.credBase;
  const putKey = card.dataset.credPutKey ?? "token";
  const input = card.querySelector<HTMLInputElement>(".cred-input");
  const value = input?.value.trim() ?? "";
  // Campo extra opcional: permite guardar SOLO ese campo (token vacío ⇒ el
  // backend conserva el ya almacenado). Sin campo extra, el token es obligatorio.
  const extra = card.querySelector<HTMLInputElement>(".cred-extra");
  const extraKey = extra?.dataset.credExtraKey ?? "";
  if (!base || (!value && !extraKey)) return;
  const body: Record<string, string> = {
    ...(value ? { [putKey]: value } : {}),
    ...(extraKey ? { [extraKey]: extra?.value.trim() ?? "" } : {}),
  };
  const btn = card.querySelector<HTMLButtonElement>(".cred-save");
  if (btn) btn.disabled = true;
  const res = await api.put(base, body);
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("error", "Ocurrió un error"), false);
    return;
  }
  if (input) input.value = "";
  showToast(t("saved", "Credencial guardada"));
  await loadTokenCard(card);
}

export async function testTokenCard(card: HTMLElement) {
  const testUrl = card.dataset.credTest;
  if (!testUrl) return;
  const btn = card.querySelector<HTMLButtonElement>(".cred-test");
  if (btn) btn.disabled = true;
  const res = await api.post<{ valid?: boolean; message?: string }>(testUrl);
  if (btn) btn.disabled = false;
  // Dos contratos: Cloudflare responde ok:true + data.valid/data.message;
  // OpenClaw refleja la validez en el ok de la envoltura (res.ok) y pone el
  // diagnóstico en data.message. Unificamos sin tocar el backend.
  const data = (res.data && typeof res.data === "object") ? (res.data as { valid?: boolean; message?: string }) : {};
  const valid = typeof data.valid === "boolean" ? data.valid : res.ok;
  const msg =
    (typeof data.message === "string" && data.message) ||
    res.error ||
    (valid ? t("testOk", "Conexión válida") : t("testFail", "No se pudo validar la credencial"));
  showToast(msg, valid);
  // Un "Probar" correcto puede traer datos nuevos (plan, límites): repinta la
  // tarjeta para que la nota refleje lo que acaba de responder el proveedor.
  if (valid) await loadTokenCard(card);
}

export async function clearTokenCard(card: HTMLElement) {
  // La ruta DELETE puede diferir de `base` (p.ej. OpenClaw borra en
  // /api/openclaw/api-key, no /config).
  const delUrl = card.dataset.credDelete || card.dataset.credBase;
  if (!delUrl) return;
  const ok = await openConfirm(t("confirmClear", "¿Quitar esta credencial?"), {
    title: t("confirmClearTitle", "Quitar credencial"),
    confirmText: t("clear", "Quitar"),
    variant: "danger",
  });
  if (!ok) return;
  const res = await api.delete(delUrl);
  if (!res.ok) {
    showToast(res.error ?? t("error", "Ocurrió un error"), false);
    return;
  }
  showToast(t("cleared", "Credencial eliminada"));
  await loadTokenCard(card);
}

// ── managed cards (asistente / backups) ──────────────────────────────────────
export function wireManagedCard(card: HTMLElement) {
  const id = card.dataset.credId;
  const btn = card.querySelector<HTMLButtonElement>(".cred-manage-assistant");
  if (id === "assistant" && btn) {
    btn.addEventListener("click", () => {
      requestAssistant({
        kind: "navigate",
        tab: "providers",
        origin: { module: "settings", action: "manageAssistantProviders" },
      });
    });
  }
  // Backups usa un <a href="/panel/backups"> nativo — sin cableado.
}
