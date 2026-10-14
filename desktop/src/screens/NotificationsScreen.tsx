import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  HardDrive,
  KeyRound,
  MemoryStick,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { getNotificationLog, type NotificationLogEntry } from "../api/client";

/** Notificaciones por página en el listado. */
const PAGE_SIZE = 6;

// Etiquetas locales (ES/EN). El sistema i18n tipado del proyecto vive en
// i18n/messages; estas etiquetas son acotadas y se mueven allí cuando se
// añadan las claves (mismo patrón TODO(i18n) que SupportScreen).
const LABELS = {
  es: {
    title: "Notificaciones",
    subtitle: "Historial de avisos de tus servidores",
    refresh: "Refrescar",
    empty: "Sin notificaciones por ahora.",
    error: "No se pudieron cargar las notificaciones.",
    loading: "Cargando…",
  },
  en: {
    title: "Notifications",
    subtitle: "Alert history from your servers",
    refresh: "Refresh",
    empty: "No notifications yet.",
    error: "Could not load notifications.",
    loading: "Loading…",
  },
} as const;

function pickLabels(language: string) {
  return language.toLowerCase().startsWith("en") ? LABELS.en : LABELS.es;
}

// Mapa de señal → icono (mismo set que la app móvil: status/cpu/ram/disk/mb/access).
const SIGNAL_ICON: Record<string, LucideIcon> = {
  status: Activity,
  cpu: Cpu,
  ram: MemoryStick,
  disk: HardDrive,
  mb: Database,
  access: KeyRound,
};

function iconForSignals(signals: string[]): LucideIcon {
  for (const s of signals) {
    const icon = SIGNAL_ICON[s.toLowerCase()];
    if (icon) return icon;
  }
  return Bell;
}

function formatWhen(iso: string, language: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(language || "es", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function NotificationsScreen({
  token,
  language,
  onOpenServer,
}: {
  token: string;
  language: string;
  /** Click en una notificación de un servidor → enfoca su tarjeta en el carousel. */
  onOpenServer?: (panelId: string) => void;
}) {
  const t = useMemo(() => pickLabels(language), [language]);
  const [rows, setRows] = useState<NotificationLogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const data = await getNotificationLog(token, 100);
      setRows(data);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }, [token, t.error]);

  useEffect(() => {
    void load();
  }, [load]);

  // Paginación: 6 por página. Al recargar (la lista puede encoger) se acota.
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => { setPage((p) => Math.min(p, totalPages - 1)); }, [totalPages]);
  const pageRows = useMemo(() => rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [rows, page]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-primary" />
          <div>
            <h2 className="text-lg font-semibold leading-tight">{t.title}</h2>
            <p className="text-sm opacity-70">{t.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost gap-2"
          onClick={() => void load()}
          disabled={busy}
        >
          <RefreshCw size={16} className={busy ? "animate-spin" : undefined} />
          {t.refresh}
        </button>
      </div>

      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {busy && rows.length === 0 ? (
          <p className="p-4 text-sm opacity-70">{t.loading}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 opacity-60">
            <Bell size={32} />
            <p className="text-sm">{t.empty}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {pageRows.map((row) => {
              const Icon = iconForSignals(row.signals);
              // Las notificaciones del monitor referencian un servidor (panelId):
              // al hacer click se va a su tarjeta del carousel (CPU/RAM/disco/etc.).
              const navigable = Boolean(row.panelId);
              return (
                <li
                  key={row.id}
                  onClick={navigable ? () => onOpenServer?.(row.panelId as string) : undefined}
                  className={`flex items-start gap-3 rounded-lg border border-base-300 bg-base-100 p-3${navigable ? " cursor-pointer transition-colors hover:border-primary hover:bg-base-200" : ""}`}
                >
                  <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-base-200 text-primary">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium">{row.title || "—"}</p>
                      <span className="flex-none text-xs opacity-60">
                        {formatWhen(row.createdAt, language)}
                      </span>
                    </div>
                    {row.body ? (
                      <p className="mt-0.5 text-sm opacity-80">{row.body}</p>
                    ) : null}
                    {row.panelName ? (
                      <p className="mt-1 text-xs opacity-60">{row.panelName}</p>
                    ) : null}
                  </div>
                  {navigable ? <ChevronRight size={16} className="mt-0.5 flex-none opacity-50 lp-rtl-flip" /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-none items-center justify-center gap-3 border-t border-base-300 pt-3">
          <button type="button" className="btn btn-sm btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft size={16} className="lp-rtl-flip" />
          </button>
          <span className="text-sm font-semibold tabular-nums">{page + 1} / {totalPages}</span>
          <button type="button" className="btn btn-sm btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
            <ChevronRight size={16} className="lp-rtl-flip" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default NotificationsScreen;
