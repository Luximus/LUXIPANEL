// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * assistant-request.ts — fuente única de verdad del contrato
 * `lxp:assistant:request` **v1** que cualquier módulo del panel usa para
 * pedirle al Asistente IA que haga algo en respuesta a una acción del usuario
 * (Monitor optimize CPU, Mail debug a mailbox, Files "open with Assistant
 * IA", Settings/Credentials deep-link to Providers, etc.).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Diseño del contrato (v1)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * • **Forma:** discriminated union `AssistantRequest` con dos variantes:
 *   `kind:"prompt"` (entrega prompt contextual al chat) y `kind:"navigate"`
 *   (salta a una pestaña del asistente). `kind:"prompt"` fuerza
 *   `target.agentId = null` y `target.projectId = null` para garantizar una
 *   conversación NORMAL — sustituye al legacy `lxp:assistant:seed` que
 *   filtraba el estado del agente activo al flujo contextual.
 *
 * • **FIFO + dedupe:** el bus mantiene una cola cap 20 y un `Set<requestId>`
 *   para descartar entradas duplicadas (la cola crece si el consumidor aún
 *   no está montado por delay de hidratación o tras un swap SPA). Los
 *   `prompt` llegan en orden; los ids repetidos por el mismo productor
 *   se descartan. Esto evita el patrón "varios botones disparan el mismo
 *   prompt en paralelo y vemos N entregas".
 *
 * • **Reset entre targets:** `resetAssistantRequestBus()` se invoca en
 *   `luxipanel:target-changed` para no arrastrar prompts pensados para el
 *   servidor anterior al nuevo.
 *
 * • **Doble entrega:** `requestAssistant()` despacha el `CustomEvent`
 *   `lxp:assistant:request` Y llama a `window.__lxpAssistantAPI.request()`
 *   si el consumidor ya montó la API global. El consumidor decide cómo
 *   arbitrar; el `CustomEvent` actúa como red de seguridad y para
 *   listeners de diagnóstico.
 *
 * • **Fail-closed:** si el módulo ai-assistant está desactivado, el
 *   consumidor NO drena la cola — descartar el prompt es preferible a
 *   entregarlo en silencio. Ver README del módulo floating-assistant.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Doble consumo (mirror de api-client.ts / datatable-events.ts)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * • React/Astro: `import { requestAssistant } from "@/lib/assistant-request"`.
 * • Extracted page scripts (esbuild `bundle:false`): importan la URL runtime
 *   `/scripts/extracted/lib/assistant-request.js?v=1`. El entry ya está
 *   registrado en `scripts/build-extracted.mjs`; añadir un import nuevo NO
 *   requiere tocar el manifest.
 *
 * ¿Por qué servirlo vía `scripts/extracted/lib/`? Astro `ClientRouter`
 * (nav SPA) NO re-evalúa `<script type="module">` en navegación entre
 * páginas — los scripts inline y los `import()` dinámicos desde una página
 * que se carga una vez sólo corren una vez. Por eso los helpers que tienen
 * que estar disponibles en TODAS las páginas del panel (request bus,
 * DataTable events, job poll, etc.) se sirven como archivos estáticos
 * versionados bajo `dist/client/scripts/extracted/lib/`. Ver
 * `frontend/ARCHITECTURE.md` §"Scripts extraídos por módulo".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Cómo extender el contrato
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Para añadir un nuevo `kind`:
 *  1. Definir el tipo en la unión `AssistantRequest`.
 *  2. Normalizarlo en `normalizeAssistantRequest()` (rellenar campos fijos).
 *  3. Manejarlo en `ChatTab` / `ChatPane` / `AssistantPanel` (consumidor).
 *  4. Añadir un test en `assistant-request.test.ts`.
 *  5. Bumpear `REQUEST_VERSION` — los consumidores viejos deben ignorar
 *     el evento silenciosamente (no hay esquema de migración in-place).
 *  6. Actualizar `frontend/src/components/floating-assistant/README.md`.
 *
 * Standalone (sin imports) para que se bundle limpiamente como entry propio.
 */

/** Versión del contrato. Bumpear si cambia la forma del payload. */
export const REQUEST_VERSION = 1 as const;

/** Nombre estable del CustomEvent versionado. */
export const ASSISTANT_REQUEST_EVENT = "lxp:assistant:request" as const;

/** Cap de la cola FIFO de hidratación. Pequeño a propósito: si se llena,
 *  las solicitudes más antiguas se descartan (la fuente de verdad es la UI,
 *  no los eventos antiguos encolados antes de hidratar). */
export const REQUEST_QUEUE_CAP = 20 as const;

/** Pestañas que la vista del Asistente expone. */
export type AssistantRequestTab =
  | "chat"
  | "agentes"
  | "providers"
  | "modules"
  | "stats"
  | "access";

/** Target fijo: toda instrucción contextual cae sobre el Asistente genérico
 *  con `agentId:null` y `projectId:null` explícitos para garantizar una
 *  conversación NORMAL (no ligada a un agente personalizado). */
export interface AssistantRequestTarget {
  kind: "assistant";
  agentId: null;
  projectId: null;
}

/** Origen de la solicitud — sólo a efectos de telemetría / debug. */
export interface AssistantRequestOrigin {
  module: string;
  action: string;
}

/** Elementos del servidor elegidos en el administrador de Archivos. */
export interface AssistantServerEntry {
  path: string;
  isDir: boolean;
  targetScope?: string;
}

/** kind="prompt": entrega un prompt contextual al chat del Asistente. */
export interface AssistantPromptRequest {
  kind: "prompt";
  /** Prompt contextual (puede ser vacío si sólo se quiere enfocar el chat). */
  prompt: string;
  /** "auto" envía inmediatamente; "prefill" sólo carga el texto en el composer. */
  submit: "auto" | "prefill";
  /** Proveedor opcional (id) — sólo elige motor/modelo, NUNCA agentId. */
  providerId?: string | null;
  /** Se leen con los permisos del usuario al entregar la solicitud al chat. */
  serverEntries?: AssistantServerEntry[];
  /** Target fijo. */
  target: AssistantRequestTarget;
  /** Conversación NORMAL nueva; garantiza limpiar el contexto agent-bound. */
  conversation: "new";
  origin: AssistantRequestOrigin;
}

/** kind="navigate": salta a una pestaña del Asistente sin entregar prompt. */
export interface AssistantNavigateRequest {
  kind: "navigate";
  tab: AssistantRequestTab;
  origin: AssistantRequestOrigin;
}

/** Unión discriminada de solicitudes válidas (v1). */
export type AssistantRequest = AssistantPromptRequest | AssistantNavigateRequest;

/** Detalle del CustomEvent `lxp:assistant:request`. */
export interface AssistantRequestEventDetail {
  version: typeof REQUEST_VERSION;
  requestId: string;
  request: AssistantRequest;
  /** Timestamp cliente en ms; sólo diagnóstico. */
  issuedAt: number;
}

/** Forma del API global expuesta en `window.__lxpAssistantAPI`. */
export interface LxpAssistantAPI {
  /**
   * Despacha una solicitud al Asistente. Devuelve `requestId` para que el
   * productor pueda correlacionar logs / abortar; NO garantiza que la
   * solicitud se entregue (puede quedar encolada o ser absorbida por la
   * vista dedicada si corresponde).
   */
  request(input: AssistantRequestInput & { requestId?: string }): string;
}

/**
 * Forma "input" que ven los productores: el helper rellena `requestId`,
 * `version`, `issuedAt` y los campos fijos (`target`, `conversation`).
 */
export type AssistantRequestInput =
  | Omit<AssistantPromptRequest, "target" | "conversation"> & {
      target?: Partial<AssistantRequestTarget>;
      conversation?: "new";
    }
  | AssistantNavigateRequest;

/** Generador de requestId: usa crypto.randomUUID cuando está disponible,
 *  con fallback a un id base36 combinando tiempo + aleatorio. Cripto-débil
 *  en el fallback pero suficiente para dedupe cliente-only. */
export function newRequestId(): string {
  try {
    const c: Crypto | undefined =
      typeof globalThis !== "undefined"
        ? (globalThis as { crypto?: Crypto }).crypto
        : undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* no-op: cae al fallback */
  }
  const rand = Math.random().toString(36).slice(2);
  const time = Date.now().toString(36);
  return `req-${time}-${rand}`;
}

/** Normaliza el input del productor rellenando los campos fijos. */
export function normalizeAssistantRequest(
  input: AssistantRequestInput,
  requestId: string,
): AssistantRequest {
  if (input.kind === "prompt") {
    return {
      kind: "prompt",
      prompt: input.prompt ?? "",
      submit: input.submit,
      providerId: input.providerId ?? null,
      ...(input.serverEntries?.length ? { serverEntries: input.serverEntries.map((entry) => ({ path: entry.path, isDir: entry.isDir, targetScope: entry.targetScope })) } : {}),
      target: { kind: "assistant", agentId: null, projectId: null },
      conversation: "new",
      origin: input.origin,
    };
  }
  return {
    kind: "navigate",
    tab: input.tab,
    origin: input.origin,
  };
}

/** Forma del payload del CustomEvent — un detalle de evento v1. */
export interface AssistantRequestBusEntry {
  version: typeof REQUEST_VERSION;
  requestId: string;
  request: AssistantRequest;
  issuedAt: number;
}

/** Estado del bus FIFO + dedupe (una sola instancia por ventana). */
interface AssistantRequestBusState {
  pending: AssistantRequestBusEntry[];
  ids: Set<string>;
}

declare global {
  interface Window {
    __lxpAssistantRequestBus?: AssistantRequestBusState;
    __lxpAssistantAPI?: LxpAssistantAPI;
  }
}

function bus(): AssistantRequestBusState {
  if (typeof window === "undefined") {
    return { pending: [], ids: new Set() };
  }
  if (!window.__lxpAssistantRequestBus) {
    window.__lxpAssistantRequestBus = { pending: [], ids: new Set() };
  }
  return window.__lxpAssistantRequestBus;
}

/**
 * Despacha una solicitud al bus. Si ya hay un consumidor válido montado
 * (`window.__lxpAssistantAPI.request`), se delega ahí — la API puede
 * resolver el arbitraje (drawer vs /panel/assistant). En cualquier caso el
 * detalle se publica también como `lxp:assistant:request` CustomEvent para
 * consumidores adicionales (logs, diagnóstico, drawer-view swap).
 *
 * Dedupe por `requestId`: si el bus ya tiene ese id, se descarta.
 * Cap FIFO: si la cola excede REQUEST_QUEUE_CAP, las entradas más antiguas
 * se descartan y sus ids se eliminan del set.
 *
 * En SSR `window` no existe: la función es defensiva y devuelve "" sin
 * lanzar (los productores deben evitar invocarla en código que pueda
 * correr en el servidor).
 */
export function requestAssistant(input: AssistantRequestInput): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "";
  }
  const requestId = newRequestId();
  const request = normalizeAssistantRequest(input, requestId);
  const entry: AssistantRequestBusEntry = {
    version: REQUEST_VERSION,
    requestId,
    request,
    issuedAt: Date.now(),
  };
  // Dedupe cliente-only: si el mismo requestId entra dos veces seguidas
  // (el productor no debería, pero defendemos en profundidad), lo descartamos.
  const b = bus();
  if (b.ids.has(requestId)) return requestId;
  b.ids.add(requestId);
  b.pending.push(entry);
  if (b.pending.length > REQUEST_QUEUE_CAP) {
    const dropped = b.pending.splice(0, b.pending.length - REQUEST_QUEUE_CAP);
    for (const d of dropped) b.ids.delete(d.requestId);
  }
  // 1) CustomEvent versionado: consumido por la cola si la API no estaba
  //    registrada aún (pre-hidratación o tras un swap SPA) y por listeners
  //    de diagnóstico.
  try {
    window.dispatchEvent(
      new CustomEvent<AssistantRequestBusEntry>(ASSISTANT_REQUEST_EVENT, {
        detail: entry,
      }),
    );
  } catch {
    /* no-op */
  }
  // 2) API global (la cola de hidratación del layout la prefiere si está lista).
  const api = window.__lxpAssistantAPI;
  if (api && typeof api.request === "function") {
    try {
      api.request({ ...input, requestId });
    } catch {
      /* no-op: el CustomEvent ya cubre al consumidor */
    }
  }
  return requestId;
}

/**
 * Drena la cola FIFO devolviendo TODAS las entradas pendientes en orden.
 * Tras drenar, vacía la cola y el set de ids (consumidor único = consumidor
 * válido). Llamado por el consumidor cuando se monta / cuando está listo
 * para procesar.
 */
export function drainAssistantRequestQueue(): AssistantRequestBusEntry[] {
  const b = bus();
  const out = b.pending.slice();
  b.pending = [];
  b.ids.clear();
  return out;
}

/** True si ya hay un request con ese id registrado (sin encolarlo). */
export function hasAssistantRequest(requestId: string): boolean {
  return bus().ids.has(requestId);
}

/** Elimina un requestId de la dedupe (p.ej. tras consumirlo). */
export function clearAssistantRequestId(requestId: string): void {
  const b = bus();
  if (b.ids.delete(requestId)) {
    const idx = b.pending.findIndex((r) => r.requestId === requestId);
    if (idx >= 0) b.pending.splice(idx, 1);
  }
}

/** Vacía el bus entero (p.ej. en luxipanel:target-changed). */
export function resetAssistantRequestBus(): void {
  const b = bus();
  b.pending = [];
  b.ids.clear();
}
