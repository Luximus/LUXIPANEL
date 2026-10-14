import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Preferencias de presentación de las burbujas del chat por proveedor
 * (solo-UI, sin estado en el servidor). Réplica RN de
 * `frontend/src/components/floating-assistant/bubble-prefs.ts` de LUXIPANEL:
 *   - input:         mostrar la entrada cruda enviada, en un bloque colapsable.
 *   - output:        mostrar la salida cruda del asistente/CLI, colapsable.
 *   - modifiedFiles: mostrar la lista "Archivos modificados" bajo cada turno.
 *   - terminalLive:  mostrar la consola del CLI en vivo. Si está OFF, el turno
 *                    corre "en segundo plano" (consola oculta) y solo se muestra
 *                    el resultado/resumen final al terminar.
 *
 * Son toggles de presentación configurados desde las tarjetas de proveedor y
 * consumidos por el pane de chat. Un pub/sub diminuto permite re-render en vivo
 * al alternar. Los campos nuevos entran ON para preservar el comportamiento
 * previo hasta que el usuario cambie el switch.
 *
 * A diferencia de la web (localStorage síncrono), aquí el backing store es
 * AsyncStorage: la caché en memoria se hidrata una vez al arrancar y `get`
 * resuelve síncronamente contra ella (mismos DEFAULTS mientras carga).
 */

export interface BubblePrefs {
  input: boolean;
  output: boolean;
  modifiedFiles: boolean;
  terminalLive: boolean;
}

const DEFAULTS: BubblePrefs = { input: false, output: false, modifiedFiles: true, terminalLive: true };

const KEY = "lxp.assistant.bubblePrefs";
const listeners = new Set<() => void>();

let cache: Record<string, Partial<BubblePrefs>> = {};
let hydrated = false;

// Hidrata la caché desde AsyncStorage una sola vez; al terminar notifica para
// que las vistas montadas antes de la hidratación reflejen el valor persistido.
void AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (raw) {
      try {
        cache = JSON.parse(raw) as Record<string, Partial<BubblePrefs>>;
      } catch {
        cache = {};
      }
    }
  })
  .catch(() => undefined)
  .finally(() => {
    hydrated = true;
    listeners.forEach((l) => l());
  });

function persist(): void {
  void AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => undefined);
  listeners.forEach((l) => l());
}

export const bubblePrefs = {
  /** True cuando la caché ya se hidrató desde AsyncStorage. */
  isHydrated(): boolean {
    return hydrated;
  },
  get(provider: string): BubblePrefs {
    // Mezcla sobre DEFAULTS para que prefs guardadas antes de existir un campo
    // sigan resolviendo (un campo ausente lee su default, no `undefined`).
    return { ...DEFAULTS, ...(cache[provider] ?? {}) };
  },
  set(provider: string, patch: Partial<BubblePrefs>): void {
    cache = { ...cache, [provider]: { ...DEFAULTS, ...(cache[provider] ?? {}), ...patch } };
    persist();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
