/**
 * useServerApi — capa de datos para las pantallas de módulos NATIVAS.
 *
 * Envuelve `callServerApi` (transporte directo del box) con el patrón
 * async+useState de la app (sin react-query). Maneja:
 *  - loading/error,
 *  - los códigos de conexión (DIRECT_AUTH_REQUIRED / PANEL_UNAVAILABLE) que en el camino WebView mostraba el panel y que aquí
 *    debemos exponer nosotros,
 *  - el desempaque del doble envelope (`unwrap`),
 *  - cancelación al desmontar/cambiar de panel.
 *
 * Las MUTACIONES se hacen llamando `serverApi`/wrappers directamente y luego
 * `await withJob(res, panelId, token)` (cola write-behind) antes de `reload()`.
 */
import { useLiveModuleData } from "../lib/use-live-module-data";
import { useNativeModuleVisible } from "../screens/main/native-module-visibility";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GatewayGuardCode,
  type GatewayResponse,
  unwrap,
  withFreshGateway,
  withJob,
} from "../api/serverApi";

const GUARD_CODES: readonly GatewayGuardCode[] = [
  "NO_CREDENTIALS",
  "FINGERPRINT_PENDING",
  "PANEL_UNAVAILABLE",
  "DIRECT_AUTH_REQUIRED",
];

function isGuardCode(code: string | undefined): code is GatewayGuardCode {
  return !!code && (GUARD_CODES as readonly string[]).includes(code);
}

export type ServerLoadState<T> = {
  data: T | null;
  loading: boolean;
  /** Mensaje de error genérico (no guard). */
  error: string | null;
  /** Código de guarda del gateway, si el panel no es alcanzable. */
  guardCode: GatewayGuardCode | null;
  /** Vuelve a cargar (también usado por pull-to-refresh). */
  reload: () => Promise<void>;
  setData: (next: T | null) => void;
};

/**
 * Carga un recurso del servidor. `load` es un thunk que devuelve la respuesta del
 * gateway (p. ej. `() => serverUsersApi.list(panelId, token)`); se re-ejecuta
 * cuando cambian `deps`. Devuelve `data` ya desempaquetado.
 */
export function useServerResource<T>(
  load: () => Promise<GatewayResponse>,
  deps: ReadonlyArray<unknown>,
  options: { enabled?: boolean } = {},
): ServerLoadState<T> {
  const [liveResource, setLiveResource] = useState<{serverId: string; resource: string} | undefined>();
  const visible = useNativeModuleVisible();
  const enabled = visible && options.enabled !== false;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const previousDeps = useRef<ReadonlyArray<unknown>>([]);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const aliveRef = useRef(true);
  const requestSeq = useRef(0);

  /**
   * `fresh` distingue las DOS razones por las que se carga:
   *  - montaje / cambio de panel (`false`): puede servirse del caché del gateway
   *    (TTL corto) → volver a una pantalla ya vista pinta al instante en vez de
   *    pagar otro round-trip por la red;
   *  - refresco EXPLÍCITO del usuario o post-mutación (`true`): salta el caché.
   */
  const run = useCallback(async (fresh: boolean) => {
    if (!enabledRef.current) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    setGuardCode(null);
    if (deps.length !== previousDeps.current.length || deps.some((value, i) => !Object.is(value, previousDeps.current[i]))) {
      setData(null);
      setLiveResource(undefined);
    }
    previousDeps.current = [...deps];
    try {
      const res = fresh
        ? await withFreshGateway(() => loadRef.current())
        : await loadRef.current();
      if (!aliveRef.current || seq !== requestSeq.current) return;
      if (isGuardCode(res.code)) {
        setData(null);
        setLiveResource(undefined);
        setGuardCode(res.code);
        setError(null);
        return;
      }
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setData(null);
          setLiveResource(undefined);
        }
        setError(res.error ?? `HTTP ${res.status ?? "?"}`);
        return;
      }
      setGuardCode(null);
      setError(null);
      if (res.liveResource) setLiveResource(previous => previous?.serverId === res.liveResource?.serverId && previous?.resource === res.liveResource?.resource ? previous : res.liveResource);
      setData(unwrap<T>(res));
    } catch (e) {
      if (!aliveRef.current || seq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      if (aliveRef.current && seq === requestSeq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => run(true), [run]);

  useEffect(() => {
    aliveRef.current = true;
    if (enabled) void run(false);
    else setLoading(false);
    return () => {
      aliveRef.current = false;
      requestSeq.current += 1;
    };
  }, [run, enabled]);

  useLiveModuleData(liveResource?.serverId ?? "", liveResource ? [liveResource.resource] : [], reload, enabled);
  return { data, loading, error, guardCode, reload, setData };
}

/** Resultado de una mutación + espera de la cola write-behind. */
export type MutationOutcome = { ok: boolean; status?: number; error?: string; code?: string };

/**
 * Ejecuta una mutación del servidor: corre `op`, espera la cola write-behind
 * (`withJob`) si la respuesta trae job, y normaliza el resultado. Lanza nunca;
 * devuelve `{ ok, error }` para que la pantalla decida (toast/recargar).
 */
export async function runServerMutation(
  panelId: string,
  token: string,
  op: () => Promise<GatewayResponse>,
): Promise<MutationOutcome> {
  try {
    const res = await op();
    if (isGuardCode(res.code)) return { ok: false, code: res.code, error: res.code };
    if (!res.ok) {
      // El error útil suele venir en el envelope del panel: { ok:false, error }.
      const panel = res.data as { error?: string; message?: string; code?: string } | undefined;
      return { ok: false, status: res.status, error: panel?.error ?? panel?.message ?? res.error, code: panel?.code };
    }
    const job = await withJob(res, panelId, token);
    if (job && job.state !== "done") {
      return { ok: false, status: res.status, error: job.error ?? "No se confirmó la operación en el servidor" };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}
