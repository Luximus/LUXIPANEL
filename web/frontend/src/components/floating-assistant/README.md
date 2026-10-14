# Floating Assistant — bus de comunicación `lxp:assistant:request` (v1)

Este documento describe el contrato único que cualquier módulo del panel usa
para pedirle al **Asistente IA** que haga algo en respuesta a una acción del
usuario (depurar una cuenta de correo, optimizar disco, abrir el chat con un
prompt pre-rellenado, saltar a una pestaña concreta, etc.).

> Fuente canónica: `frontend/src/lib/assistant-request.ts`. Los cambios
> incompatibles deben bumpear `REQUEST_VERSION`; los campos opcionales nuevos
> conservan v1 cuando los consumidores anteriores pueden ignorarlos.

## 1. Qué es el bus v1

`lxp:assistant:request` es un `CustomEvent` versionado que se dispara sobre
`window`. La idea: que **un único consumidor** (`FloatingAssistantDrawer` o la
vista dedicada `/panel/assistant`) decida qué hacer, sin que cada caller tenga
que saber si el FAB está montado, qué provider está activo o si el módulo
ai-assistant está desactivado.

Pieza | Qué hace
---|---
`requestAssistant(input)` | Helper que rellena `version`, `requestId`, `issuedAt` y los campos fijos, despacha el `CustomEvent` y, si el consumidor ya montó la API global (`window.__lxpAssistantAPI.request`), también la invoca.
`drainAssistantRequestQueue()` | Devuelve y vacía la cola FIFO pendiente. Lo llama el consumidor al montar o tras un swap SPA.
`resetAssistantRequestBus()` | Vacía la cola y el set de ids. Se llama en `luxipanel:target-changed` para no arrastrar prompts entre servidores conectados.
`hasAssistantRequest(id)` / `clearAssistantRequestId(id)` | Dedupe manual para consumidores que necesiten quitar una entrada ya procesada.
`REQUEST_QUEUE_CAP = 20` | Tope FIFO. Si se llena, las entradas más antiguas se descartan (la fuente de verdad es la UI, no eventos previos al hydration).
`REQUEST_VERSION = 1` | Versión del contrato. Bumpear ante cambios incompatibles del payload.

Archivos puede incluir `serverEntries?: { path: string; isDir: boolean }[]` en
una solicitud `prompt`. El chat lee cada ruta mediante las API de Archivos con
los permisos y el servidor activo del usuario; incorpora texto y un resumen
limitado de carpetas al mensaje, y adjunta binarios compatibles con el modelo.
El límite es de 20 elementos, 28 000 caracteres de contexto, 8 MB por binario
y 24 MB de binarios en total.
Si una ruta no se puede leer, el mensaje indica el error en vez de atribuirle
contenido inexistente. El campo opcional conserva el contrato v1.

**Dedupe cliente-only:** el bus rechaza entradas con `requestId` repetido vía
`bus().ids`. Adicionalmente, `ChatPane` mantiene un `Set<requestId>` local
(`assistantRequestConsumedRef`) para descartar dobles renders del `useEffect`
que dispara la entrega — eso es deduplicación del consumidor, no del bus.

**Doble consumo.** `requestAssistant()` hace dos cosas a la vez:
1. Despacha el `CustomEvent` (`window.dispatchEvent(new CustomEvent(ASSISTANT_REQUEST_EVENT, { detail }))`).
2. Si `window.__lxpAssistantAPI.request` está registrado (consumidor ya
   montado), también lo invoca pasando el `input` y el mismo `requestId`.

La invocación de la API global incluye el mismo `requestId` del evento. El
drawer deduplica por ese ID y conserva la solicitud hasta que el Asistente
cargue la configuración y los proveedores. Entonces la entrega al flujo
`new-assistant` del chat con el proveedor elegido y `submit:"auto"` intactos.

El consumidor decide cómo arbitrar; el `CustomEvent` sirve como red de
seguridad y para listeners de diagnóstico.

## 2. Kinds soportados (discriminated union)

El campo `kind` es la pieza discriminante de `AssistantRequest`. Sólo hay dos
variantes en el contrato v1:

### `"prompt"` — entrega un prompt contextual al chat

```ts
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";

requestAssistant({
  kind: "prompt",
  prompt: "Depura la cuenta info@dominio.com — revisa cuotas y últimos errores.",
  submit: "auto",          // "auto" envía; "prefill" sólo carga en el composer
  origin: { module: "mail", action: "debugAccount" },
});
```

Campos:
- `prompt: string` — instrucción contextual; puede ir vacía si sólo se quiere
  enfocar el chat.
- `submit: "auto" | "prefill"` — política de envío.
- `providerId?: string | null` — opcional, sólo elige motor/modelo (NUNCA
  fuerza un agente personalizado).
- `target` — **fijo**, lo rellena `normalizeAssistantRequest()`:
  `{ kind: "assistant", agentId: null, projectId: null }`. Garantiza una
  conversación **NORMAL** (sin agente, sin proyecto) y limpia el contexto
  agent-bound del pane.
- `conversation: "new"` — fijo; garantiza chat nuevo. Evita reusar un chat
  previo ligado a un agente.
- `origin: { module, action }` — sólo telemetría/debug.

### `"navigate"` — salta a una pestaña del Asistente

```ts
requestAssistant({
  kind: "navigate",
  tab: "providers",
  origin: { module: "settings", action: "openCredentials" },
});
```

`tab` ∈ `"chat" | "agentes" | "providers" | "modules" | "stats" | "servers" | "access"`.

No lleva `prompt`, `target` ni `conversation` — sólo cambia la pestaña visible
del consumidor. Es lo que sustituye al legacy `lxp:assistant:open`.

## 3. Cómo consumir el bus desde un caller nuevo

1. **Importa el helper.** Desde scripts extraídos
   (`frontend/src/scripts/extracted/**/index-script1.ts`):

   ```ts
   import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
   ```

   Desde código React/TypeScript "moderno":

   ```ts
   import { requestAssistant } from "@/lib/assistant-request";
   ```

2. **Llama al helper** con el `kind` adecuado (`"prompt"` o `"navigate"`). Si
   es un prompt:
   - `submit: "auto"` si la acción del usuario implica enviar la consulta de
     forma natural (cron, firewall, users, expo-logs, monitor "optimizeDisk").
   - `submit: "prefill"` si quieres dejar el texto listo para que el usuario
     revise antes de enviar (files, mail, obsidian, module-dev, expo).

3. **No toques `scripts/build-extracted.mjs`.** El entry `lib/assistant-request.ts`
   ya está registrado ahí. Si añades un import nuevo, basta con que `tsc`
   siga limpio: `cd frontend && npx tsc --noEmit`.

4. **i18n.** Cualquier string visible va en los 12 locales
   (`frontend/src/i18n/{ar,bn,de,en,es,fr,hi,it,ja,ko,pt,ru}/<ns>.ts`). El
   prompt puede contener tokens i18n; el listener del consumidor los respeta
   porque llega como `string` ya renderizado.

5. **Verifica que no quedan legacy.** Repositorio limpio: no debe quedar
   `dispatchEvent("lxp:assistant:seed" | "lxp:assistant:open")` en callers
   nuevos. (El `FloatingAssistantDrawer` mantiene compat temporal interna con
   esos eventos por si llega algo viejo durante el rollout — fuera del drawer
   ya no se emiten.)

## 4. Fail-closed del módulo ai-assistant

Si el módulo Asistente IA está **desactivado** en el catálogo del panel, el
listener del consumidor (`FloatingAssistantDrawer.useEffect` del bus +
`AssistantPanel` en `/panel/assistant`) **NO drena la cola**.

Por qué importa: si la cola se drenara pero el módulo estuviera apagado, el
prompt se perdería en silencio (sin entregarse al backend) y el usuario vería
un toast "Abriendo asistente…" sin que pase nada. Peor aún, en flujos
auto-send (`submit: "auto"`) la UI podría dar la sensación de que el botón
"optimizar disco" no hace nada. Por eso el consumidor valida primero el
flag `capabilities.assistantEnabled` (o el equivalente) antes de procesar
entradas; si está apagado, las solicitudes se descartan sin efecto.

Si necesitas soporte explícito: emite una notificación lateral desde el caller
("El módulo Asistente IA está desactivado; actívalo en Configuración → Módulos")
en lugar de confiar en que el consumidor hará feedback.

## 5. Reset entre targets

Cuando el usuario cambia de servidor conectado (`POST /api/servers/:id/switch`
en el backend), el frontend dispara `luxipanel:target-changed`. El listener
del `FloatingAssistantDrawer` invoca `resetAssistantRequestBus()` para vaciar
la cola.

Razón: los prompts encolados estaban pensados para el servidor anterior
(pertenecen a su contexto, herramientas y sidecars). Si no se vaciaran, al
abrir el drawer en el servidor nuevo se entregarían instrucciones obsoletas
contra el target equivocado. Por eso `resetAssistantRequestBus()` se llama
**antes** de cualquier nueva entrega y los prompts nuevos llevan siempre
`origin.module/action` para diagnóstico si algo se cruza.

## 6. Tests

`frontend/src/lib/assistant-request.test.ts` cubre los invariantes del
contrato:

- (a) prompt request lleva `target.agentId=null` y `target.projectId=null`
  (conversación NORMAL).
- (b) `submit:"prefill"` mantiene el target NORMAL.
- (c) doble render con mismo `requestId` se procesa una sola vez vía el Set
  local del consumidor.
- FIFO cap: al superar `REQUEST_QUEUE_CAP` se descartan las entradas más
  antiguas.
- `version` siempre es `1`.
- `streamAgent` y `assistantConversationsApi.create` aceptan `null` LITERAL y
  lo incluyen en el body (no lo omiten) — esto evita que el backend infiera
  el último agente activo.

Para ejecutar:

```bash
cd frontend
npx vitest run src/lib/assistant-request.test.ts
```

## 7. Extender el contrato

Si necesitas un nuevo `kind`:

1. Añade el tipo a la unión `AssistantRequest` en `assistant-request.ts` y
   normalízalo en `normalizeAssistantRequest()`.
2. Maneja la nueva variante en el consumidor (`ChatTab` / `ChatPane` /
   `AssistantPanel`).
3. Añade un test en `assistant-request.test.ts`.
4. **Bumpea `REQUEST_VERSION`** — los consumidores viejos deben ignorar
   silenciosamente el evento (no hay esquema de migración in-place).
5. Actualiza este README con un mini-ejemplo.

Si sólo quieres un nuevo `submit` (p.ej. `"draft"`), añade el literal al
union y al `normalizeAssistantRequest()`. El bus no necesita cambios.

## 8. Continuidad de los mensajes en cola

Al terminar un turno, `chat-engine/send.ts` conserva si había mensajes en cola
antes de actualizar su copia local. Una respuesta vacía de `/agent/queue` puede
significar que el servidor ya tomó el siguiente mensaje para ejecutarlo.
`onCleanSettle` debe seguir esa cadena igualmente: recarga el historial y adopta
el nuevo stream, con reintentos si aún se está persistiendo el turno del usuario.
`chat-engine/send.test.ts` cubre la transición de dos turnos en API y CLI,
la persistencia tardía y la ausencia de sondeos cuando no hay mensajes en cola.
