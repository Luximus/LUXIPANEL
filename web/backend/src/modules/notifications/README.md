# Módulo `notifications`

Campana del panel: mensajes de sistema / módulo / IA / seguridad / usuario, con
feed SSE en tiempo real y un bus de eventos interno que traduce eventos de otros
módulos a filas de la campana (sin acoplar módulos entre sí).

## Endpoints (todos tras `requireAuth`; las mutaciones con `csrfProtection`)

| Método | Ruta | Qué hace |
|---|---|---|
| GET    | `/api/notifications` | lista paginada + filtros (source/module/unreadOnly/scope) |
| GET    | `/api/notifications/unread-count` | contador (cache in-process 30s) |
| GET    | `/api/notifications/stream` | feed SSE (heartbeat 15s) |
| POST   | `/api/notifications` | crear (admin/interno) |
| POST   | `/api/notifications/read-all` | marcar todas leídas |
| PATCH  | `/api/notifications/:id/read` | marcar una leída |
| DELETE | `/api/notifications/:id` | borrar una |
| DELETE | `/api/notifications` | limpiar todas del llamante |

## Capas

- **`models/notification.model`** — `Notification` / `NewNotification`,
  `NotificationSource`, `NotificationSeverity`, y el campo **`target`**
  (aterrizaje exacto, ver abajo).
- **`models/notification-target`** — `NotificationTarget` (mismo shape que
  `SearchTarget` del super buscador: `href`, `query`, `hash`, `click`,
  `clickSeq`, `event`), `NOTIFICATION_EVENT_ALLOWLIST`,
  `sanitizeNotificationTarget` (**fail-closed**), `targetToLink`,
  `linkToTarget` y `notificationTargetSchema` (Zod).
- **`repositories/notifications.repository`** — file-backed vía `dataStore`
  (`notifications/notifications.json`). Filtrado + scoping por usuario
  (`matchesUser`: null = global), orden newest-first, paginación, `trim` a
  5 000 filas en cada insert para acotar el sidecar.
- **`services/notifications.service`** — helper write-once + wiring del event
  bus (`NOTIFICATION_RULES`, tabla declarativa ~30 eventos → notificación).
  Funciones puras exportadas y testeadas en `notifications.rules.test.ts`:
  `buildNotificationFromRule(rule, data)` (resuelve + sanea el `target` y
  deriva `link` cuando la regla no trae uno) y `pickNotificationMetadata(data)`
  (**solo escalares**, strings ≤500; elimina objetos/funciones y en particular
  `executor`, que antes se persistía entero desde `AI_TEAM_PLAN_COMPLETED`).
  Lecturas y mutaciones usan el ejecutor del servidor conectado. Los eventos
  internos resuelven su servidor por contexto o `targetId`/`scope`; si el
  servidor remoto no está disponible, no se guardan en el host del panel.
  `tryCreate` registra el fallo sin abortar la acción origen. El contador
  separa servidor y usuario; el SSE filtra ambos antes de entregar eventos.
- **`controllers`** — valida con Zod (`ValidationError` tipado); el SSE
  registra/limpia listeners del `notificationsBus` en `close`/`aborted`.

## Agent-capability

**N/A** — la campana es superficie HTTP/SSE para el usuario, no una capacidad
que el agente IA invoque. No se registra `AgentCapability`.

## `target` — aterrizaje exacto (clic en la campana)

Una fila puede llevar, además del `link` clásico, un `target` con el **mismo
shape que `SearchTarget`** (`frontend/src/lib/search-catalog.ts`). El frontend
lo ejecuta con el runtime del super buscador: navega, espera el DOM y luego
hace `click`/`clickSeq` o despacha `event`. Así "Certificado SSL emitido" abre
NGINX **en el tab SSL**, y "Chat IA finalizado" reabre **esa** conversación.

| Evento(s) | `target` |
|---|---|
| `ALERT_*`, `WRITE_QUEUE_*`, `REMOTE_CACHE_BREAKER_OPEN` | `/panel/monitor` |
| `SSL_*` | `/panel/nginx` + `click:"#tab-ssl"` |
| `BACKUP_*`, `FIREWALL_*`, `WEBHOOK_FAILED`, `MAIL_CLONE_*`, `HOSTING_JAIL_DEGRADED`, `PREVIEW_SANDBOX_*` | vista del módulo (`/panel/backups`, `/panel/firewall`, `/panel/webhooks`, `/panel/mail`, `/panel/hosting`, `/panel/module-dev`) |
| `CLOUDFLARE_*` | `/panel/cloudflare` + `query:{tab}` + `click:'[data-tab="…"]'` |
| `AUTH_LOGIN_FAILED` | `/panel/preferences#pref-audit` |
| `AUTH_PASSKEY_REGISTERED` | `/panel/preferences#pref-passkeys` |
| `CLI_JOB_*`, `AI_CHAT_FINISHED`, `AI_PERMISSION_REQUESTED`, `AI_TEAM_PLAN_COMPLETED` | `/panel?c=<conv>[&provider]` + `event luxipanel:assistant-open-conversation` (sin conversación → `/panel`) |
| `CHAT_MESSAGE_RECEIVED` | `/panel/chat?c=<conv>` |

> La home del panel **es** "Agentes IA": `/panel/assistant` redirige a `/` y
> perdía el `?c=`. Por eso los deep-links de IA apuntan a `/panel`.

### Reglas de seguridad del `target` (fail-closed)

`sanitizeNotificationTarget` es la ÚNICA puerta (se aplica también en
`create`/`tryCreate`, nunca se confía en el emisor):

- `href`: solo `^/panel(?:/[A-Za-z0-9_\-./]*)?$`, sin `//`, `\`, `:` ni `..`.
  Un `href` presente e inválido **descarta el target entero**.
- `query`: ≤10 claves, valores string ≤200.
- `hash`: `^#[A-Za-z0-9_-]{1,64}$`.
- `click` / `clickSeq`: ≤6 pasos, ≤200 chars, charset de selector CSS.
- `event.name` DEBE estar en `NOTIFICATION_EVENT_ALLOWLIST`
  (`luxipanel:assistant-open-conversation`, `…-settings-open`,
  `…-new-conversation`); `detail` solo escalares (≤10 claves).

### Cuerpo legible

Los emisores de IA ya no vuelcan el log crudo ni el JSON de la respuesta: el
preview pasa por `shared/text/humanize-preview.ts` (`humanizePreview`) y por
`ai-assistant/services/conversation-message-normalizer.deriveNotificationPreview`
(último bloque narrativo, sin ANSI ni marcadores de herramienta). Un JSON como
`{"overallRisk":"medium","keyThreats":[…]}` se muestra como
`Riesgo: medio · Amenazas: … (+2)`. Cuando el emisor resuelve el título de la
conversación, el cuerpo es `«<título>» — <resumen>`.

## Pendiente

- **`metadata.i18n`**: los títulos/cuerpos de `NOTIFICATION_RULES` están en
  español fijo. Para traducirlos en el cliente habría que persistir en
  `metadata.i18n` la clave + parámetros de cada fila (y añadir las claves a los
  12 locales). No es barato; se documenta como deuda consciente.
