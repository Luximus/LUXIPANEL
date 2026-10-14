/**
 * ModulesModule (desktop) — pantalla NATIVA del módulo Módulos de un servidor
 * standalone (conexión DIRECTA por `serverApi`). Port React DOM COMPLETO de
 * `app/src/screens/server/modules/ModulesViewScreen.tsx`, conservando estilos
 * (Tailwind + daisyUI + lucide-react), i18n (`getMessages(...).serverModulesView`)
 * y contrato (`serverModulesViewApi` + token `""` en modo directo).
 *
 * Paridad con app: buscador, lista de módulos con toggle mostrar/ocultar
 * (PATCH /api/admin/modules/:id) y REORDEN local por fila (subir/bajar) que se
 * persiste con "Guardar orden" (PUT /api/admin/modules/order). El reorden solo
 * se ofrece SIN búsqueda (opera sobre la lista completa); un orden pendiente se
 * conserva a través de recargas (toggle/refrescar) hasta guardar o descartar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Puzzle, RefreshCw, Save, Search } from "lucide-react";
import { useToast } from "../../../components/ToastProvider";
import {
  serverModulesViewApi,
  unwrap,
  withJob,
  type GatewayGuardCode,
  type GatewayResponse,
} from "../../../api/serverApi";
import { getMessages } from "../../../i18n";
import type { ModuleProps } from "../module-host";

const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE"];

type ModuleRow = { id: string; name: string; description?: string; enabled?: boolean; category?: string };

/** Espejo del `runServerMutation` de app (`app/src/hooks/useServerApi.ts`). */
async function runServerMutation(
  serverId: string,
  op: () => Promise<GatewayResponse>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await op();
    if (res.code && GUARDS.includes(res.code)) return { ok: false, error: res.code };
    if (!res.ok) {
      const panel = res.data as { error?: string; message?: string } | undefined;
      return { ok: false, error: panel?.error ?? panel?.message ?? res.error };
    }
    await withJob(res, serverId, "");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

/** Reordena `list` para que respete el orden de ids `desired` (ids ausentes al
 *  final, estable). Permite conservar un reordenamiento local sin guardar a
 *  través de una recarga (p. ej. tras un toggle o refresco). */
function sortByDesired(list: ModuleRow[], desired: string[]): ModuleRow[] {
  const pos = new Map(desired.map((id, i) => [id, i] as const));
  const at = (id: string) => (pos.has(id) ? (pos.get(id) as number) : Number.MAX_SAFE_INTEGER);
  return [...list].sort((a, b) => at(a.id) - at(b.id));
}

export function ModulesModule({ serverId, language }: ModuleProps) {
  const t = getMessages(language).serverModulesView;
  const c = getMessages(language).common;
  const toast = useToast();

  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  // Orden deseado sin guardar (ids). Si está, las recargas lo conservan para no
  // perder el reordenamiento local al hacer toggle / refrescar.
  const pendingOrderRef = useRef<string[] | null>(null);
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    const res = await serverModulesViewApi.list(serverId, "");
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    const list = (unwrap<ModuleRow[]>(res) ?? []).filter(Boolean);
    if (!aliveRef.current) return;
    const desired = pendingOrderRef.current;
    setRows(desired ? sortByDesired(list, desired) : list);
  }, [serverId]);

  useEffect(() => {
    aliveRef.current = true;
    setLoading(true);
    void load().finally(() => {
      if (aliveRef.current) setLoading(false);
    });
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (aliveRef.current) setRefreshing(false);
  }, [load]);

  const toggle = useCallback(
    async (m: ModuleRow, next: boolean) => {
      setBusyId(m.id);
      const out = await runServerMutation(serverId, () => serverModulesViewApi.toggle(serverId, "", m.id, next));
      setBusyId(null);
      if (out.ok) {
        toast.success(t.toasts.saved);
        void load(); // recarga: el toggle puede afectar dependencias; conserva el orden pendiente
      } else toast.error(out.error ?? t.toasts.error);
    },
    [serverId, toast, load, t],
  );

  // Mueve un módulo una posición (sobre la lista COMPLETA `rows`, por id) y marca
  // el orden como sucio. No hay red aquí: solo estado local + ref del orden.
  const move = useCallback((id: string, dir: "up" | "down") => {
    setRows((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx < 0) return prev;
      const j = dir === "up" ? idx - 1 : idx + 1;
      if (j < 0 || j >= prev.length) return prev;
      const nextRows = prev.slice();
      const tmp = nextRows[idx];
      nextRows[idx] = nextRows[j];
      nextRows[j] = tmp;
      pendingOrderRef.current = nextRows.map((m) => m.id);
      return nextRows;
    });
    setOrderDirty(true);
  }, []);

  const saveOrder = useCallback(async () => {
    setSavingOrder(true);
    const order = rows.map((m) => m.id);
    const out = await runServerMutation(serverId, () => serverModulesViewApi.reorder(serverId, "", order));
    setSavingOrder(false);
    pendingOrderRef.current = null;
    setOrderDirty(false);
    if (out.ok) toast.success(t.toasts.orderSaved);
    else toast.error(out.error ?? t.toasts.orderError); // en error, la recarga restaura el orden del servidor
    void load();
  }, [rows, serverId, toast, load, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) : rows;
  }, [rows, query]);
  const searching = query.trim().length > 0;

  // ── Render ──────────────────────────────────────────────────────────────
  if (guardCode) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.pageTitle}</h2>
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-xl border border-base-300 bg-base-100 p-5">
          <p className="text-sm text-error">{t.loadError}</p>
          <p className="font-mono text-xs text-base-content/50">{guardCode}</p>
          <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => void onRefresh()}>
            <RefreshCw size={14} /> {c.refresh}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera + refrescar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-semibold">{t.pageTitle}</h2>
          <p className="text-xs text-base-content/60">{t.subtitle}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />} {c.refresh}
        </button>
      </div>

      {/* Buscador */}
      <label className="input input-bordered input-sm flex max-w-md items-center gap-2">
        <Search size={15} className="text-base-content/50" />
        <input
          type="text"
          className="grow"
          value={query}
          placeholder={t.search}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {/* Banner de orden sin guardar */}
      {orderDirty ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3">
          <span className="min-w-0 flex-1 text-xs text-base-content/70">{t.orderUnsaved}</span>
          <button
            type="button"
            className="btn btn-primary btn-sm gap-1.5"
            onClick={() => void saveOrder()}
            disabled={savingOrder}
          >
            {savingOrder ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
            {t.orderSave}
          </button>
        </div>
      ) : null}

      {searching ? <p className="text-xs text-base-content/50">{t.reorderSearchHint}</p> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-base-content/50">{t.empty}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100">
          {filtered.map((m, i) => {
            const on = m.enabled !== false;
            const isFirst = i === 0;
            const isLast = i === filtered.length - 1;
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 p-3.5 ${i === 0 ? "" : "border-t border-base-300"}`}
              >
                <Puzzle size={18} className={on ? "text-primary" : "text-base-content/40"} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{m.name}</span>
                  <span className="truncate text-[11px] text-base-content/50">
                    {m.description ?? (on ? t.statusVisible : t.statusHidden)}
                  </span>
                </div>
                {/* Botones de reorden: solo sin búsqueda (operan sobre la lista completa) */}
                {!searching ? (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost border border-base-300 px-1.5"
                      onClick={() => move(m.id, "up")}
                      disabled={isFirst || savingOrder}
                      aria-label={t.moveUp}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost border border-base-300 px-1.5"
                      onClick={() => move(m.id, "down")}
                      disabled={isLast || savingOrder}
                      aria-label={t.moveDown}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                ) : null}
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-primary"
                  checked={on}
                  disabled={busyId === m.id}
                  onChange={(e) => void toggle(m, e.target.checked)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
