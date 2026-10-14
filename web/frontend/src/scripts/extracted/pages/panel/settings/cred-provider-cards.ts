// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Credentials tab — storage provider cards (Cloudflare R2 / S3) and office
// connector cards (Google Drive / OneDrive / Dropbox / Notion). The two caches
// they populate live on the shared hub `S` (reset per-load by cred-gating).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { escapeHtml, setStatus, showToast, t } from "./cred-dom";
import type { ConnectorStatus, ProviderCred } from "./cred-state";
import { S } from "./cred-state";

// ── storage provider cards (Cloudflare R2 / S3) ───────────────────────────────
async function fetchProviderCreds(force = false): Promise<ProviderCred[]> {
  if (S.providerCredsCache && !force) return S.providerCredsCache;
  const res = await api.get<ProviderCred[]>("/api/backups/provider-creds");
  S.providerCredsCache = res.ok && Array.isArray(res.data) ? res.data : [];
  return S.providerCredsCache;
}

function sf(card: HTMLElement, field: string): HTMLInputElement | null {
  return card.querySelector<HTMLInputElement>(`.cred-sf[data-field="${field}"]`);
}

function applyStorageState(card: HTMLElement, cred: ProviderCred | null) {
  const configured = Boolean(cred?.configured);
  setStatus(card, configured, cred?.accessKeyId ?? "");
  // Prefill non-secret fields (never the password field).
  for (const field of ["accountId", "accessKeyId", "endpoint", "region"]) {
    const el = sf(card, field);
    if (el && el.type !== "password") el.value = (cred as unknown as Record<string, string>)?.[field] ?? "";
  }
  const clearBtn = card.querySelector<HTMLButtonElement>(".cred-clear");
  if (clearBtn) {
    clearBtn.classList.toggle("hidden", !configured);
    clearBtn.classList.toggle("inline-flex", configured);
  }
}

export async function loadStorageCard(card: HTMLElement) {
  const provider = card.dataset.credProvider ?? "";
  const creds = await fetchProviderCreds();
  applyStorageState(card, creds.find((c) => c.provider === provider) ?? null);
}

export async function saveStorageCard(card: HTMLElement) {
  const provider = card.dataset.credProvider ?? "";
  if (!provider) return;
  const body: Record<string, string> = {
    accessKeyId: sf(card, "accessKeyId")?.value.trim() ?? "",
    accountId: sf(card, "accountId")?.value.trim() ?? "",
    endpoint: sf(card, "endpoint")?.value.trim() ?? "",
    region: sf(card, "region")?.value.trim() ?? "",
  };
  const secret = sf(card, "secretAccessKey")?.value ?? "";
  if (secret) body.secretAccessKey = secret;
  if (!body.accessKeyId) return;
  const btn = card.querySelector<HTMLButtonElement>(".cred-save");
  if (btn) btn.disabled = true;
  const res = await api.put(`/api/backups/provider-creds/${provider}`, body);
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("error", "Ocurrió un error"), false);
    return;
  }
  const secretEl = sf(card, "secretAccessKey");
  if (secretEl) secretEl.value = "";
  showToast(t("saved", "Credencial guardada"));
  await fetchProviderCreds(true);
  await loadStorageCard(card);
}

export async function clearStorageCard(card: HTMLElement) {
  const provider = card.dataset.credProvider ?? "";
  if (!provider) return;
  const ok = await openConfirm(t("confirmClear", "¿Quitar esta credencial?"), {
    title: t("confirmClearTitle", "Quitar credencial"),
    confirmText: t("clear", "Quitar"),
    variant: "danger",
  });
  if (!ok) return;
  const res = await api.delete(`/api/backups/provider-creds/${provider}`);
  if (!res.ok) {
    showToast(res.error ?? t("error", "Ocurrió un error"), false);
    return;
  }
  showToast(t("cleared", "Credencial eliminada"));
  await fetchProviderCreds(true);
  await loadStorageCard(card);
}

// ── office connector cards (Google Drive / OneDrive / Dropbox / Notion) ───────
let connectorsAvailable = true;

async function fetchConnectors(force = false): Promise<ConnectorStatus[]> {
  if (S.connectorsCache && !force) return S.connectorsCache;
  const res = await api.get<{ connectors?: ConnectorStatus[] }>("/api/ai/connectors");
  if (!res.ok) {
    connectorsAvailable = false; // p.ej. módulo Asistente IA deshabilitado (403)
    S.connectorsCache = [];
    return S.connectorsCache;
  }
  connectorsAvailable = true;
  const list = (res.data as { connectors?: ConnectorStatus[] })?.connectors;
  S.connectorsCache = Array.isArray(list) ? list : [];
  return S.connectorsCache;
}

function renderConnectorCard(card: HTMLElement, status: ConnectorStatus | null) {
  const fieldsEl = card.querySelector<HTMLElement>(".cred-connector-fields");
  const stepsEl = card.querySelector<HTMLElement>(".cred-help-steps");
  const linkEl = card.querySelector<HTMLElement>(".cred-help-link");
  const errEl = card.querySelector<HTMLElement>(".cred-connector-err");
  const disc = card.querySelector<HTMLButtonElement>(".cred-disconnect");

  if (!status) {
    setStatus(card, false, t("connector.unavailable", "Requiere el módulo Agentes IA habilitado"), t("connector.notConnected", "Sin conectar"));
    if (fieldsEl) fieldsEl.innerHTML = "";
    if (disc) disc.classList.add("hidden");
    return;
  }

  const ok = status.connected || status.configured;
  const label = status.connected
    ? t("connector.connected", "Conectado")
    : status.configured
      ? t("connector.configured", "Configurado")
      : t("connector.notConnected", "Sin conectar");
  setStatus(card, ok, "", label);

  if (errEl) {
    errEl.textContent = status.lastError ?? "";
    errEl.classList.toggle("hidden", !status.lastError);
  }
  if (disc) disc.classList.toggle("hidden", !status.configured);

  // Render credential fields (only once / when empty). Grid 2-col; textarea o
  // campo único ocupan la fila completa (col-span-2).
  if (fieldsEl && fieldsEl.childElementCount === 0) {
    const single = status.credentialFields.length === 1;
    fieldsEl.innerHTML = status.credentialFields
      .map((f) => {
        const inputCls = "cred-cf w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
        const control =
          f.type === "textarea"
            ? `<textarea data-key="${escapeHtml(f.key)}" rows="3" placeholder="${escapeHtml(f.placeholder ?? "")}" class="${inputCls} font-mono"></textarea>`
            : `<input data-key="${escapeHtml(f.key)}" type="${f.type === "password" ? "password" : "text"}" autocomplete="off" placeholder="${escapeHtml(f.placeholder ?? "")}" class="${inputCls} font-mono" />`;
        const help = f.help ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(f.help)}</p>` : "";
        const span = f.type === "textarea" || single ? " col-span-2" : "";
        return `<div class="min-w-0${span}"><label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">${escapeHtml(f.label)}</label>${control}${help}</div>`;
      })
      .join("");
  }
  // Guía de ayuda (pestaña Ayuda): pasos del catálogo + enlace.
  if (stepsEl && stepsEl.childElementCount === 0 && Array.isArray(status.setup?.steps)) {
    stepsEl.innerHTML = status.setup!.steps!.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  }
  if (linkEl && linkEl.childElementCount === 0 && status.setup?.docUrl) {
    linkEl.innerHTML = `<a href="${escapeHtml(status.setup.docUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><i class="ti ti-external-link text-sm"></i> ${escapeHtml(status.setup.docLabel || t("help.openLink", "Abrir enlace"))}</a>`;
  }
}

export async function loadConnectorCard(card: HTMLElement) {
  const id = card.dataset.credId ?? "";
  const list = await fetchConnectors();
  if (!connectorsAvailable) {
    renderConnectorCard(card, null);
    return;
  }
  renderConnectorCard(card, list.find((c) => c.id === id) ?? null);
}

export async function connectConnector(card: HTMLElement) {
  const id = card.dataset.credId ?? "";
  if (!id) return;
  const secrets: Record<string, string> = {};
  card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".cred-cf[data-key]").forEach((el) => {
    const key = el.dataset.key ?? "";
    const val = el.value.trim();
    if (key && val) secrets[key] = val;
  });
  if (Object.keys(secrets).length === 0) return;
  const btn = card.querySelector<HTMLButtonElement>(".cred-connect");
  if (btn) btn.disabled = true;
  const res = await api.post(`/api/ai/connectors/${id}/connect`, { secrets });
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("error", "Ocurrió un error"), false);
    return;
  }
  showToast(t("saved", "Credencial guardada"));
  card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".cred-cf[data-key]").forEach((el) => { el.value = ""; });
  await fetchConnectors(true);
  await loadConnectorCard(card);
}

export async function disconnectConnector(card: HTMLElement) {
  const id = card.dataset.credId ?? "";
  if (!id) return;
  const ok = await openConfirm(t("confirmClear", "¿Quitar esta credencial?"), {
    title: t("connector.disconnect", "Desconectar"),
    confirmText: t("connector.disconnect", "Desconectar"),
    variant: "danger",
  });
  if (!ok) return;
  const res = await api.post(`/api/ai/connectors/${id}/disconnect`);
  if (!res.ok) {
    showToast(res.error ?? t("error", "Ocurrió un error"), false);
    return;
  }
  showToast(t("cleared", "Credencial eliminada"));
  await fetchConnectors(true);
  await loadConnectorCard(card);
}
