// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MailSignaturesDrawer — right-side drawer to manage a mail account's email
 * signatures. Opened by dispatching a window CustomEvent:
 *
 *   window.dispatchEvent(new CustomEvent("lxp:mail:open-signatures", {
 *     detail: { id: <accountId:number>, address: "<addr:string>" },
 *   }));
 *
 * Backend (already wired):
 *   GET    /api/accounts/:id/signatures            -> { ok, data: Signature[] }
 *   POST   /api/accounts/:id/signatures            -> { ok, data: Signature }
 *   PUT    /api/accounts/:id/signatures/:sigId     -> { ok, data: Signature }
 *   DELETE /api/accounts/:id/signatures/:sigId     -> { ok }
 *
 * A signature (matches backend `SidecarSignature`):
 *   { id:number, senderName:string, senderEmail:string, linkToSender:boolean,
 *     html:string, createdAt:string, updatedAt:string }
 */
import * as React from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { api } from "@/lib/api-client";

interface Signature {
  id: number;
  senderName: string;
  senderEmail: string;
  linkToSender: boolean;
  html: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DraftState {
  senderName: string;
  senderEmail: string;
  linkToSender: boolean;
  html: string;
}

const EMPTY_DRAFT: DraftState = { senderName: "", senderEmail: "", linkToSender: false, html: "" };
const OPEN_EVENT = "lxp:mail:open-signatures";

export default function MailSignaturesDrawer() {
  const [open, setOpen] = React.useState(false);
  const [accountId, setAccountId] = React.useState<number | null>(null);
  const [address, setAddress] = React.useState("");

  const [items, setItems] = React.useState<Signature[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  // Editor: null = closed, "new" = creating, number = editing that id.
  const [editing, setEditing] = React.useState<"new" | number | null>(null);
  const [draft, setDraft] = React.useState<DraftState>(EMPTY_DRAFT);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const flashTimer = React.useRef<number | null>(null);
  const showFlash = React.useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 2500);
  }, []);

  const load = React.useCallback(async (id: number) => {
    setLoading(true);
    setListError(null);
    const res = await api.get<Signature[]>(`/api/accounts/${id}/signatures`);
    setLoading(false);
    if (!res.ok || !Array.isArray(res.data)) {
      setListError(res.error ?? "No se pudieron cargar las firmas.");
      setItems([]);
      return;
    }
    setItems(res.data);
  }, []);

  // Open on the account-scoped custom event.
  React.useEffect(() => {
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<{ id: number; address: string }>).detail;
      if (!detail || typeof detail.id !== "number") return;
      setAccountId(detail.id);
      setAddress(detail.address ?? "");
      setEditing(null);
      setDraft(EMPTY_DRAFT);
      setFormError(null);
      setFlash(null);
      setOpen(true);
      void load(detail.id);
    }
    window.addEventListener(OPEN_EVENT, onOpen as EventListener);
    return () => window.removeEventListener(OPEN_EVENT, onOpen as EventListener);
  }, [load]);

  React.useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  function startCreate() {
    setEditing("new");
    setDraft({ ...EMPTY_DRAFT, senderEmail: address });
    setFormError(null);
  }

  function startEdit(sig: Signature) {
    setEditing(sig.id);
    setDraft({
      senderName: sig.senderName ?? "",
      senderEmail: sig.senderEmail ?? "",
      linkToSender: !!sig.linkToSender,
      html: sig.html ?? "",
    });
    setFormError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
  }

  async function save() {
    if (accountId == null) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      senderName: draft.senderName.trim(),
      senderEmail: draft.senderEmail.trim() || undefined,
      linkToSender: draft.linkToSender,
      html: draft.html,
    };
    const res =
      editing === "new"
        ? await api.post<Signature>(`/api/accounts/${accountId}/signatures`, payload)
        : await api.put<Signature>(`/api/accounts/${accountId}/signatures/${editing}`, payload);
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error ?? "No se pudo guardar la firma.");
      return;
    }
    cancelEdit();
    showFlash(editing === "new" ? "Firma creada." : "Firma actualizada.");
    await load(accountId);
  }

  async function remove(sig: Signature) {
    if (accountId == null) return;
    const label = sig.senderName || sig.senderEmail || "esta firma";
    if (!window.confirm(`¿Eliminar la firma "${label}"?`)) return;
    setBusyId(sig.id);
    const res = await api.delete(`/api/accounts/${accountId}/signatures/${sig.id}`);
    setBusyId(null);
    if (!res.ok) {
      showFlash(res.error ?? "No se pudo eliminar la firma.");
      return;
    }
    if (editing === sig.id) cancelEdit();
    showFlash("Firma eliminada.");
    await load(accountId);
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerContent
        className="!max-w-none w-[92vw] sm:w-[560px] lg:w-[640px] !h-[var(--lxp-vvh,100dvh)] !max-h-[var(--lxp-vvh,100dvh)] !mt-0 !rounded-none flex flex-col bg-card"
      >
        <DrawerTitle className="sr-only">Firmas de correo</DrawerTitle>

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <i className="ti ti-signature text-lg text-primary" />
              <h2 className="text-base font-semibold">Firmas</h2>
            </div>
            {address ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{address}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Cerrar"
          >
            <i className="ti ti-x text-base" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {flash ? (
            <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
              {flash}
            </div>
          ) : null}

          {/* Editor form */}
          {editing !== null ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!saving) void save();
              }}
              className="mb-5 rounded-xl border border-border bg-background p-4 space-y-3"
            >
              <p className="text-sm font-semibold">
                {editing === "new" ? "Nueva firma" : "Editar firma"}
              </p>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nombre del remitente</label>
                <input
                  type="text"
                  value={draft.senderName}
                  maxLength={128}
                  onChange={(e) => setDraft((d) => ({ ...d, senderName: e.target.value }))}
                  placeholder="Ej. Soporte LuxiSoft"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Correo del remitente</label>
                <input
                  type="email"
                  value={draft.senderEmail}
                  onChange={(e) => setDraft((d) => ({ ...d, senderEmail: e.target.value }))}
                  placeholder={address || "usuario@dominio.com"}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-[11px] text-muted-foreground">
                  Si se deja vacío se usa la dirección de la cuenta.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Contenido (HTML)</label>
                <textarea
                  value={draft.html}
                  onChange={(e) => setDraft((d) => ({ ...d, html: e.target.value }))}
                  rows={7}
                  placeholder="<p>Saludos,<br>El equipo</p>"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={draft.linkToSender}
                  onChange={(e) => setDraft((d) => ({ ...d, linkToSender: e.target.checked }))}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Enlazar al remitente
              </label>

              {draft.html.trim() ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Vista previa</p>
                  <div
                    className="max-h-40 overflow-hidden rounded-lg border border-border bg-card p-3 text-sm"
                    // Backend sanitizes signature HTML; kept contained here.
                    dangerouslySetInnerHTML={{ __html: draft.html }}
                  />
                </div>
              ) : null}

              {formError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {formError}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving ? <i className="ti ti-loader-2 animate-spin text-sm" /> : <i className="ti ti-check text-sm" />}
                  Guardar
                </button>
              </div>
            </form>
          ) : (
            <div className="mb-4">
              <button
                type="button"
                onClick={startCreate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <i className="ti ti-plus text-sm" />
                Nueva firma
              </button>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <i className="ti ti-loader-2 animate-spin text-base" />
              Cargando firmas…
            </div>
          ) : listError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {listError}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <i className="ti ti-signature mb-2 text-2xl text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Sin firmas todavía</p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                Crea una firma para usarla al redactar correos.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((sig) => (
                <li key={sig.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {sig.senderName || sig.senderEmail || "Firma"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{sig.senderEmail}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {sig.linkToSender ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          <i className="ti ti-link text-[10px]" /> Enlazada
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => startEdit(sig)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="Editar firma"
                        title="Editar"
                      >
                        <i className="ti ti-pencil text-sm" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(sig)}
                        disabled={busyId === sig.id}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        aria-label="Eliminar firma"
                        title="Eliminar"
                      >
                        {busyId === sig.id ? (
                          <i className="ti ti-loader-2 animate-spin text-sm" />
                        ) : (
                          <i className="ti ti-trash text-sm" />
                        )}
                      </button>
                    </div>
                  </div>
                  {sig.html?.trim() ? (
                    <div
                      className="mt-3 max-h-28 overflow-hidden rounded-lg border border-border bg-card p-3 text-sm text-foreground"
                      dangerouslySetInnerHTML={{ __html: sig.html }}
                    />
                  ) : (
                    <p className="mt-3 text-xs italic text-muted-foreground/70">Sin contenido</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
