/**
 * StandaloneManagerModal (desktop) — gestor de servidores LUXIPANEL
 * **standalone** por conexión DIRECTA (sin LP-LS). Espejo de
 * `app/src/screens/server/standalone/StandaloneManagerScreen.tsx` adaptado a
 * Electron/web y a las clases `lp-modal-*` del desktop.
 *
 * Vista interna: LISTA (servidores guardados, con abrir/reconectar y eliminar) →
 * ALTA (`AddStandaloneServerModal`). Al abrir un servidor, **registra su
 * `DirectTarget`** (`serverApi.ensureTarget` / relogin silencioso con la
 * contraseña opt-in) ANTES de delegar la apertura de módulos en `onOpenServer`,
 * igual que el overlay de la app monta las pantallas nativas tras
 * `registerDirectServer`. Si no hay sesión válida ni contraseña guardada, cae a
 * la re-conexión manual (alta pre-rellenada).
 */
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Plus, Server, Trash2, X } from "lucide-react";
import { unregisterDirectServer } from "../api/serverApi";
import {
  listStandaloneServers,
  removeStandaloneServer,
  type StandaloneServer,
} from "../lib/standalone-servers";
import { registerStandaloneTarget } from "../lib/standalone-connect";
import { AddStandaloneServerModal } from "./AddStandaloneServerModal";
import { formatMessage, getMessages } from "../i18n";

export function StandaloneManagerModal({
  open,
  onClose,
  onOpenServer,
  language,
}: {
  open: boolean;
  onClose: () => void;
  /** Se invoca DESPUÉS de registrar el `DirectTarget` del servidor: el host abre
   *  las vistas de módulo NATIVAS (`StandaloneServerScreen`) que hablan directo
   *  al box por `serverApi`. NUNCA abre webview ni el navegador del SO. */
  onOpenServer?: (server: StandaloneServer) => void;
  language?: string;
}) {
  const t = getMessages(language).serverStandalone;

  const [servers, setServers] = useState<StandaloneServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "add">("list");
  const [reconnect, setReconnect] = useState<StandaloneServer | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<StandaloneServer | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setServers(listStandaloneServers());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) { reload(); setView("list"); setReconnect(undefined); }
  }, [open, reload]);

  // NOTA: el desregistro del `DirectTarget` lo posee ahora la pantalla nativa de
  // módulos (`StandaloneServerScreen`): lo re-asegura al montar y lo libera al
  // desmontar. Aquí NO se desregistra al cerrar, porque cerrar el gestor es
  // justo la transición hacia esa pantalla (un unregister aquí mataría el
  // target recién armado antes de que la pantalla lo use).

  const openServer = useCallback(async (server: StandaloneServer) => {
    setBusyId(server.id);
    const ok = await registerStandaloneTarget(server);
    setBusyId(null);
    if (ok) {
      onOpenServer?.(server);
      onClose();
    } else {
      // Sin sesión válida ni contraseña → pedir reconexión manual (alta pre-rellenada).
      setReconnect(server);
      setView("add");
    }
  }, [onOpenServer, onClose]);

  if (!open) return null;

  // ── Alta / re-conexión ──────────────────────────────────────────────────────
  if (view === "add") {
    return (
      <AddStandaloneServerModal
        open
        existing={reconnect}
        language={language}
        onClose={() => { setView("list"); setReconnect(undefined); }}
        onDone={async (server) => {
          setReconnect(undefined);
          reload();
          await openServer(server);
        }}
      />
    );
  }

  // ── Lista de servidores standalone ──────────────────────────────────────────
  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[155] grid place-items-center p-4">
      <div className="lp-modal-card flex max-h-full w-full max-w-lg flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <div className="flex flex-col">
            <h3 className="lp-modal-title">{t.title}</h3>
            <span className="text-xs text-base-content/60">{t.listSubtitle}</span>
          </div>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.cancel}>
            <X size={18} />
          </button>
        </div>

        <div className="lp-modal-body flex flex-col gap-3">
          <button
            type="button"
            className="lp-connect-method-option"
            onClick={() => { setReconnect(undefined); setView("add"); }}
          >
            <span className="lp-connect-method-option__icon"><Plus size={18} /></span>
            <span className="lp-connect-method-option__body">
              <strong>{t.addServer}</strong>
              <span>{t.launcherHint}</span>
            </span>
          </button>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Server size={28} className="text-base-content/40" />
              <p className="text-sm text-base-content/60">{t.empty}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {servers.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-3 dark:border-zinc-700 dark:bg-zinc-800/50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Server size={18} />
                  </span>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col text-left"
                    onClick={() => void openServer(s)}
                    disabled={busyId === s.id}
                  >
                    <span className="truncate text-sm font-semibold text-base-content">{s.name}</span>
                    <span className="truncate text-xs text-base-content/60">{s.baseUrl}</span>
                    <span className="truncate text-xs text-base-content/60">{s.username}</span>
                  </button>
                  {busyId === s.id ? (
                    <span className="loading loading-spinner loading-sm text-primary" />
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-square"
                      onClick={() => void openServer(s)}
                      aria-label={t.open}
                    >
                      <ChevronRight size={18} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-square text-error"
                    onClick={() => setConfirmRemove(s)}
                    aria-label={t.remove}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {confirmRemove ? (
            <div className="rounded-xl border border-error/40 bg-error/5 p-3">
              <p className="text-sm text-base-content">
                {formatMessage(t.removeConfirm, { name: confirmRemove.name })}
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => setConfirmRemove(null)}>
                  {t.cancel}
                </button>
                <button
                  type="button"
                  className="lp-modal-btn lp-modal-btn--primary !bg-error !border-error"
                  onClick={() => {
                    const target = confirmRemove;
                    setConfirmRemove(null);
                    unregisterDirectServer(target.id);
                    removeStandaloneServer(target.id);
                    reload();
                  }}
                >
                  {t.remove}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
