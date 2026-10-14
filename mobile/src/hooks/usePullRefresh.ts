import { useCallback, useState } from "react";

/**
 * Helper de "deslizar hacia abajo para actualizar" (pull-to-refresh): ejecuta
 * `fn` y mantiene `refreshing` en true mientras dura, para alimentar el
 * `<RefreshControl>` de un ScrollView/FlatList. `fn` puede ser síncrona o async;
 * los errores no rompen el spinner (siempre se apaga en el finally).
 */
export function usePullRefresh(fn: () => Promise<unknown> | unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fn();
    } catch {
      // best-effort: el contenido conserva su último estado bueno.
    } finally {
      setRefreshing(false);
    }
  }, [fn]);
  return { refreshing, onRefresh };
}
