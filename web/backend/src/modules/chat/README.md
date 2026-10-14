<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Módulo `chat` — mensajería interna entre usuarios

Chat 1:1 y de grupo entre **cuentas Linux reales del servidor conectado**. No
inventa usuarios ni grupos: la agenda es `getent passwd` / `getent group` y la
presencia es `who`. Disponible para **cualquier** usuario autenticado del panel
(no hay gate de módulo ni de permiso: es una función entre pares).

## Invariante: todo es PER-SERVIDOR

Cada lectura/escritura pasa por el `Executor` de la petición, así que un mensaje
persistido en el servidor X nunca se ve desde una sesión puenteada al servidor Y.
Los sidecars viven bajo `${LUXIPANEL_CONFIG_DIR}/chat/` **en el servidor
conectado**:

| Sidecar | Contenido |
|---|---|
| `chat/conversations.json` | Conversaciones (`dm`, `group`, `linux-group`). |
| `chat/messages_<convId>.json` | Una colección **por conversación** (tope 1000 filas, se poda al insertar). Nombres >64 chars se acortan con sufijo hash. |
| `chat/reads.json` | Cursor de lectura por `(convId, username)`. |
| `chat/profiles.json` | Perfil de chat por usuario (id = username): `showOnline`, `statusMessage`. |
| `chat/attachments-index.json` | Índice `id → {convId, name, mimeType, path, bytes, ts}`. |
| `chat/attachments/<convId>/<id>-<nombre>` | Bytes de los adjuntos, modo `0600`. |

Los **ajustes de mensajería** (bloque E) NO viven aquí: son por-usuario del panel
y van en `users/preferences.json` bajo la clave `chat` (ver más abajo).

## Anatomía

```
models/chat.model.ts          Conversación, mensaje, agenda, perfil, adjunto listado, evento SSE
repositories/                 conversations · messages · reads · attachments · profiles
services/chat.service.ts      Lógica de conversación/mensaje + bus + presencia + adjuntos + perfil
services/directory.service.ts Agenda: usuarios, nombres visibles, grupos, presencia
services/tolqia-bridge.service.ts  Audiollamadas: S2S con Tolqia + webhooks firmados
controllers/chat.controller.ts HTTP + SSE + servido de adjuntos
controllers/call.controller.ts Superficie HTTP de las llamadas (+ webhook sin sesión)
controllers/attachment-headers.ts  Política PURA de servido (inline/descarga, firma, Range, CSP)
routes/chat.routes.ts         requireAuth + csrfProtection en mutaciones
```

## Nombre visible (nunca el login)

La UI **jamás** muestra un usuario Linux. El nombre humano sale del campo GECOS
de `passwd`:

- `directoryService.displayNames(executor): Promise<Map<username, displayName>>`
  — solo `getent passwd` (ni `who` ni grupos), **memoizado 60 s por target** y
  **fail-open** (mapa vacío ante error → el llamador cae al username).
  `invalidateDisplayNames(targetId?)` es la costura de test.
- `ChatMessage.fromDisplayName?` se **decora al leer/emitir**, nunca se persiste:
  un cambio de nombre en `/etc/passwd` se refleja al instante en todo el
  historial.
- `ConversationView.memberNames: Record<username, displayName>` (total sobre
  `members`) + `otherDisplayName?` en DMs.
- `ChatMessageEvent.conversation.memberNames?` viaja en el evento SSE.
- Grupo ad-hoc **sin título** → el título visible son los nombres de los otros
  miembros. Push a ausentes → `«Nombre»` (DM) o `«Nombre · Título del grupo»`.

## Tiempo real (SSE) y presencia

`GET /api/chat/stream` mantiene la respuesta abierta y reenvía los eventos del
`chatBus` en proceso. Un evento llega a una conexión solo si **ambas** cosas se
cumplen: `event.targetId === targetId de la sesión` (aislamiento por servidor) y
el username está en `participants`. Eventos: `chat:message`, `chat:read`.

Dos presencias distintas, no confundir:

1. **Presencia de stream** (`chatPresence`, en memoria, `targetId::username`,
   ref-counted): quién tiene una conexión SSE viva. Decide quién está **ausente**
   y por tanto recibe campana + push.
2. **Presencia de sistema** (`who`): sesiones de login reales. Es la que se
   muestra como "en línea", y el usuario puede **ocultarla** con
   `showOnline: false` en su perfil (entonces se reporta `online: false` para
   todo el mundo).

## Push a ausentes

`sendMessage` → `notifyAwayRecipients` filtra los participantes sin stream vivo,
mapea `username → {username, userId?}` (`resolveRecipients`, una sola lectura del
sidecar de usuarios) y emite **un** `Events.CHAT_MESSAGE_RECEIVED` en el bus
compartido. Los módulos `notifications` / alertas se suscriben ahí: el módulo
chat **no** importa a ninguno (regla de módulos independientes).

## Privacidad de la agenda

`listUsers(executor, viewer?)`: si `viewer` es **no-admin**, la lista se limita a
quienes comparten al menos un grupo del sistema con él (deny-by-default; incluye
compañeros de grupo primario, que `getent group` no lista). `createOrGetDm` y
`createGroup` aplican el mismo filtro para que no se pueda saltar la lista
mandando un username conocido por POST.

## Adjuntos

- Subida: `sendMessage` con `attachments[]` (base64, ≤10 por mensaje). Los bytes
  se escriben en paralelo y el índice se registra en **una** transacción (un
  read-modify-write concurrente perdería todos los registros menos el último).
- Listado (drawer Multimedia):
  `chatService.listAttachments(executor, username, convId)` cruza **todos** los
  mensajes (`messagesRepository.listAll`, sin tope de página) con el índice
  (`attachmentsRepository.listByConvId` → `id → bytes`). Salta los mensajes
  borrados y ordena por `createdAt` descendente. El gate es `getConversation`.

### Política de servido (`attachment-headers.ts`)

Un adjunto son **bytes y un MIME que eligió el usuario**: la política es
deny-by-default y vive en una función pura, `resolveInlinePolicy`, para poder
testear la decisión de seguridad sin HTTP.

1. **Allowlist inline**: imágenes raster (`png, jpeg, jpg, gif, webp, bmp, avif,
   x-icon, vnd.microsoft.icon`) + `application/pdf` + `video/mp4`, `video/webm` +
   audio `audio/mpeg|ogg|wav|x-wav|webm|mp4`. Todo lo demás — **SVG, HTML, texto**
   y cualquier tipo desconocido — se sirve `application/octet-stream` +
   `Content-Disposition: attachment`.
2. **Verificación de firma** para los tipos no-imagen: PDF `%PDF-` (en el primer
   KB), MP4/M4A `ftyp` en offset 4, WebM/MKV `1A 45 DF A3`, OGG `OggS`, WAV
   `RIFF….WAVE`, MP3 `ID3` o frame sync `FF Ex/Fx`. Si la firma no cuadra, el
   adjunto se **degrada a descarga**: un `video/mp4` que en realidad es HTML no
   se renderiza jamás.
3. **Cabeceras siempre**: `X-Content-Type-Options: nosniff`,
   `Content-Disposition` con nombre saneado (ASCII entre comillas + `filename*=UTF-8''…`;
   se eliminan comillas y CR/LF para que no se puedan inyectar directivas ni
   partir cabeceras), `Cache-Control: private, max-age=86400`,
   `Accept-Ranges: bytes`.
4. **CSP**: `Content-Security-Policy: sandbox allow-scripts` **solo** para PDF
   (PDFium de Chrome necesita scripting, en origen opaco); `sandbox` a secas para
   vídeo y audio; las imágenes no llevan CSP. El frontend embebe el PDF en un
   `<iframe sandbox="allow-scripts">` sin `allow-same-origin` (la CSP de página
   tiene `object-src 'none'`, así que `<object>` no vale).
5. **Range**: `bytes=a-b`, `bytes=a-` y `bytes=-N` → `206` + `Content-Range` +
   `Content-Length`; rango imposible o malformado → `416` + `bytes */<size>`.
   Safari no reproduce medios sin esto.

Además, el controlador cachea los bytes en un **LRU de 8 entradas × 60 s** por
`${targetId}:${attachmentId}`: un scrub de vídeo dispara decenas de `Range` y
`readBlob` trae el blob entero por SSH en cada uno. La caché nunca es
autoritativa (se puede vaciar sin efecto funcional) y está segmentada por target.

## Perfil de chat

`GET /api/chat/me/profile` · `PUT /api/chat/me/profile` (CSRF). Solo el perfil
**propio**; el username sale de la sesión, nunca del cuerpo.

```jsonc
// PUT body (ambos opcionales)
{ "showOnline": true, "statusMessage": "En una reunión" }  // statusMessage ≤80, nullable
// respuesta
{ "ok": true, "data": { "username": "alice", "showOnline": true,
                        "statusMessage": "En una reunión", "updatedAt": "…" } }
```

`showOnline: false` fuerza `online: false` en `listUsers` y en los miembros de
grupo; `statusMessage` se adjunta como `status` en ambos sitios. Toda lectura del
sidecar de perfiles es **fail-open**: si no se puede leer, se ignoran las
exclusiones de presencia en vez de romper la agenda.

## Ajustes de mensajería (módulo `users`)

Viven en `users/models/preferences.model.ts` (blob `users/preferences.json`, clave
`chat`) y se sirven en `GET/PUT /api/preferences/chat`. Secciones: `general`
(`soundOnNewMessage`, `desktopNotifications`, `previewInBell`, `enterSends`),
`appearance` (`density`, `fontSize`), `groups` (`collapsedByDefault`,
`latestPageSize` 5|10|15) y `calls` (`language`, `translate`, `provider`,
`micDefault`, `ringtone`, `dnd`). El GET devuelve **siempre** el objeto completo
(`CHAT_PREFERENCES_DEFAULTS` deep-merged con lo guardado) y el PUT mezcla **por
sección**, así que un parche de una clave no borra el resto.

Ojo a la separación: los ajustes son **por usuario del panel**; la presencia y el
estado son **por servidor** (describen una cuenta Linux) y por eso están en
`/api/chat/me/profile`, no aquí.

## Contrato HTTP

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/chat/stream` | SSE (`chat:message`, `chat:read`) |
| GET | `/api/chat/conversations` | `{ok, data: ConversationView[]}` |
| GET | `/api/chat/conversations/:id/messages?before=&limit=` | `{ok, data: ChatMessage[]}` (con `fromDisplayName`) |
| GET | `/api/chat/conversations/:id/attachments` | `{ok, data: ChatAttachmentListItem[]}` |
| GET | `/api/chat/unread-count` | `{ok, count}` |
| GET | `/api/chat/directory` | `{ok, data: {users, groups}}` |
| GET | `/api/chat/me/profile` | `{ok, data: ChatProfile}` |
| GET | `/api/chat/attachments/:id` | bytes (ver política de servido) |
| PUT | `/api/chat/me/profile` | `{ok, data: ChatProfile}` |
| POST | `/api/chat/conversations` | `201 {ok, data: ChatConversation}` |
| POST | `/api/chat/conversations/:id/messages` | `201 {ok, data: ChatMessage}` |
| POST | `/api/chat/conversations/:id/read` | `{ok}` |
| PATCH | `/api/chat/conversations/:id/messages/:messageId` | `{ok, data: ChatMessage}` |
| DELETE | `/api/chat/conversations/:id/messages/:messageId` | `{ok, data: ChatMessage}` (borrado suave) |

Todas requieren sesión; las mutaciones llevan `csrfProtection`.

## Llamadas (Tolqia)

Audiollamadas 1:1 y de grupo con **traducción en tiempo real**, servidas por el
producto independiente **Tolqia** (`/var/www/tolqia`, pm2 `tolqia`,
`127.0.0.1:4500`). LUXIPANEL es solo el integrador: no mezcla audio, no habla
con ElevenLabs/OpenAI y no monta ningún WebSocket propio.

```
navegador ──WS directo (wsUrl de Tolqia)──▶ Tolqia
    │                                          │
    └── REST /api/chat/... ─▶ LUXIPANEL ──S2S──┘
                                  ▲
                                  └── webhooks firmados
```

### Piezas

| Fichero | Papel |
|---|---|
| `services/tolqia-bridge.service.ts` | TODA la integración: crear/unirse, tokens, rechazar, colgar, webhooks, registro en memoria. |
| `controllers/call.controller.ts` | Adaptador HTTP fino + gate `CALL_ENABLED`. |
| `routes/call-webhook.routes.ts` | Router PÚBLICO del webhook, montado en `app.ts` antes que los routers de módulo. |
| `shared/chat-call-types.ts` | Contrato gemelo de `frontend/src/lib/chat-call.ts` (`ChatCallView`, eventos SSE, `system.kind==="call"`). |
| `services/tolqia-account.service.ts` | Enlace con la cuenta de tolqia.com: sonda `GET /v1/calls/account`, caché de 5 min, plan y límites. |
| `repositories/tolqia-credential.repository.ts` | El token `tq_live_…` del servidor, cifrado AES-256-GCM en `chat/tolqia-credential.json` (0600). |
| `controllers/tolqia.controller.ts` | Tarjeta de Ajustes → Credenciales (`/config` + `/test`) y `/plan` para la UI. |
| `services/tolqia-errors.ts` | Errores tipados del gate del plan (401/402/403 → códigos accionables). |

### Rutas

| Método | Ruta | Respuesta |
|---|---|---|
| POST | `/api/chat/conversations/:id/call` | `201 {ok, data: ChatCallSession}` (nueva) / `200` con `joined:true` (sala viva). Rate limit **10/min por usuario**. |
| GET | `/api/chat/conversations/:id/call` | `{ok, data: ChatCallView\|null}` (caché 2 s). |
| GET | `/api/chat/calls/:callId` | `{ok, data: ChatCallView}` |
| POST | `/api/chat/calls/:callId/accept` | `{ok, data: ChatCallSession}` |
| POST | `/api/chat/calls/:callId/reject` | `{ok, data: ChatCallView}` |
| POST | `/api/chat/calls/:callId/end` | `{ok, data: ChatCallView}` |
| POST | `/api/chat/calls/webhook` | **Sin sesión ni CSRF** — autenticado por HMAC. |
| GET | `/api/chat/conversations/:id/messages/:mid/transcript` | `{ok, data: {segments, truncated, participants}}` (miembros) |
| GET | `/api/chat/tolqia/config` | **admin** · `{ok, data:{tokenSet, tokenPreview, account?, accountSummary?}}` |
| PUT | `/api/chat/tolqia/config` | **admin** · `{token}` → valida formato + `GET /v1/calls/account`; **400** si inválido |
| DELETE | `/api/chat/tolqia/config` | **admin** · desenlaza el servidor (idempotente) |
| POST | `/api/chat/tolqia/test` | **admin** · `{ok, data:{valid, plan, limits, message}}` — **siempre 200** |
| GET | `/api/chat/tolqia/plan` | cualquier usuario autenticado · `{configured, plan, status, limits, translationAvailable}` |

Con `CALL_ENABLED=false` **todas** devuelven 404: la función desaparece en vez
de fallar.

### El token de la cuenta de Tolqia (planes Plus/Premium)

LUXIPANEL se **une a Tolqia con un token de API** que el dueño genera en
tolqia.com (Ajustes › API). El token es **por servidor** y vive cifrado
(AES-256-GCM, clave HKDF derivada de `CREDENTIAL_VAULT_KEY` — mismo esquema que
la bóveda de `modules/servers`) en `${LUXIPANEL_CONFIG_DIR}/chat/tolqia-credential.json`
(`0600`) del servidor conectado. **Nunca** sale del backend: lo que llega al
navegador es presencia + un prefijo de 12 caracteres (`tq_live_abcd`).

| | **Sin token** (comportamiento previo) | **Con token** |
|---|---|---|
| Bearer hacia Tolqia | `TOLQIA_SERVICE_SECRET` (S2S interno) | el propio `tq_live_…` |
| `credentials` en `POST /v1/calls/rooms` | sí — claves del panel, `credentialsPolicy:"host"` | **no** se envían: paga y pone las claves el dueño del token |
| Límites de plan | ninguno | Tolqia aplica `translationParticipants` / `maxGroups` / `maxMembers` |

La elección la hace `resolveAuth(executor)` en el bridge, y **todas** las
llamadas del mismo `Executor` (crear, token de participante, rechazar, colgar,
snapshot, transcripción) usan el mismo bearer. Si no hay ni token ni secreto,
la función responde "no configurado" (503) en vez de fallar a medias.

**Gate del plan (401/402/403 ⇒ códigos accionables, nunca un 503 "reintenta"):**

| Upstream | Error tipado | HTTP + `code` |
|---|---|---|
| 401 | `TolqiaTokenInvalidError` | 401 `TOLQIA_TOKEN_INVALID` |
| 402 | `TolqiaPlanInactiveError` | 402 `TOLQIA_PLAN_INACTIVE` |
| 403 | `TolqiaPlanRequiredError` | 403 `TOLQIA_PLAN_REQUIRED` |

Cuando el plan no da para tanta traducción, Tolqia **no falla**: crea la sala con
`translation.enabled=false` y `reason:"PLAN_LIMIT_TRANSLATION"`. El bridge lo
propaga a `ChatCallView.translation.reason` (y por tanto al SSE), y el overlay
pinta un aviso discreto con enlace a `https://tolqia.com/pricing`. El motivo se
descarta si la sala **sí** traduce: un aviso sobre una llamada que traduce sería
mentira.

**Frontend.** Tarjeta *Tolqia* en Ajustes → Credenciales (contrato canónico
`data-cred-card`, gate `assistant`, nota viva `accountSummary` con plan y
límites) y, en Mensajes, badge del plan en `ChatSettingsDrawer` › Llamadas
(`GET /api/chat/tolqia/plan`; el enlace a Credenciales solo lo ven los admins).
i18n: `settings.credentials.tolqia.*` y `chat.call.plan.*` en los 12 locales.

### El webhook

Vive en **`routes/call-webhook.routes.ts`**, un router público montado en
`app.ts` junto a `cronApprovalsPublicRouter`/`webhookIngestPublicRouter` —
**no** en `chat.routes.ts`. Motivo verificado contra el backend vivo: varios
routers de módulo (mail, users, dashboard, …) hacen `router.use(requireAuth)`
**sin ruta**, lo que en Express corre para toda petición que el router *ve*, no
solo las que enruta; como se registran antes que `chat`, cualquiera de ellos
contesta 401 a `/api/chat/calls/webhook` antes de que el router de chat tenga
turno (`/api/definitely/not/a/route` también devuelve 401).

Quien llama es Tolqia por loopback, sin sesión. Su autenticación es la firma sobre los **bytes crudos**
(`req.rawBody`, capturado por el `express.json({ verify })` global — nunca una
re-serialización). Orden obligatorio: ventana de ±300 s → HMAC con
`timingSafeEqual` → `JSON.parse` → dedupe por `eventId`.

`room.ended` / `room.missed` → `chatService.postSystemMessage` con
`system:{kind:"call", callId, outcome, durationSec, participants:[nombre visible]}`
y el texto «Llamada de voz · 04:12 · 2 participantes» / «Llamada perdida» /
«Llamada rechazada». El resto de eventos solo refresca la UI.

### Transcripción por participante

Una llamada deja en el hilo **lo que dijo cada quien, en su idioma**, más la
traducción que produjo la pasarela.

- **De dónde sale.** `room.ended`/`room.missed` trae `data.transcript`
  (`{seq, participantId, displayName, lang, text, translations, startMs, endMs}[]`)
  y `data.transcriptTruncated`. Si el webhook no la trae y la llamada se
  completó, el bridge tira de `GET /v1/calls/rooms/:id/transcript` (bearer
  `TOLQIA_SERVICE_SECRET`, disponible 24 h). **Las dos vías son fail-open**: sin
  transcripción el chip de la llamada se publica igual.
- **Dónde vive.** Dentro del mensaje de sistema: `system.transcript`,
  `system.transcriptTruncated`, `system.transcriptSegments`. El mensaje va al
  sidecar `chat/messages_<convId>.json`, que se reescribe entero en cada
  inserción, así que hay **cap duro**: 2000 segmentos / 200 KB serializados
  (`services/call-transcript.ts`, `capTranscript`). Al recortar se conserva el
  **principio** de la llamada.
- **TRAMPA — el listado NO lleva la transcripción.** `decorate()` la quita de
  todo mensaje que sale por `GET .../messages` y por SSE (200 KB × N llamadas en
  una página de 50 mensajes serían megas por render). Lo que viaja es
  `transcriptSegments`; el cuerpo se pide bajo demanda a
  `GET /api/chat/conversations/:id/messages/:mid/transcript`.
- **Nunca un login.** `participantId` ES el usuario Linux y solo se usa como
  clave de join y de filtro; cada `displayName` se re-resuelve contra
  `directoryService.displayNames` al leer (`projectTranscript`), igual que
  `fromDisplayName`.
- **Frontend.** El chip gana «Ver transcripción» → `CollapseY` con
  `call/CallTranscriptPanel.tsx`: avatar + nombre visible + hora relativa,
  texto original con badge de idioma, traducción al idioma del lector
  (`chat-prefs.calls.language`, si no la primera disponible), «otras
  traducciones» plegable, filtro por participante y botón copiar.

### SSE

`CHAT_EVENTS.CALL` en `chatBus` → `chat:call:ring|state|end` en
`GET /api/chat/stream`, con el mismo filtro `targetId` + participante que los
mensajes. Al abrir el stream se reproduce el estado de las llamadas vivas
(`chat:call:state`) para que una recarga a mitad de llamada recupere la UI.

### Invariantes

- **Nunca un login en la UI.** El `participantId` de Tolqia ES el usuario Linux
  (única identidad estable por servidor), pero cada `displayName` se re-resuelve
  contra `directoryService.displayNames` al proyectar, y `ChatCallView` es lo
  único que sale al navegador.
- **Las credenciales no salen del backend.** Sin token de Tolqia,
  `resolveCallProviderCredentials` (barrel de `ai-assistant`) las lee de la
  config del asistente del target y viajan a nivel de sala
  (`credentialsPolicy: "host"`). **Con token del servidor ni siquiera se leen**:
  las pone Tolqia por cuenta del dueño del token. En ningún caso aparecen en una
  respuesta, un frame SSE o un log — y el propio `tq_live_…` tampoco.
- **`externalId = lxp:<targetId>:<convId>`.** Tolqia garantiza una sola sala viva
  por `externalId`: el 409 con la sala viva ES el camino «Unirse», y hace el
  endpoint idempotente ante un doble clic.
- **`wsUrl` se reenvía tal cual.** Ya lleva el token y el prefijo público
  (`TOLQIA_PUBLIC_PATH`); componerlo a mano rompe el montaje.
- **Preferencias:** idioma/traducción/proveedor/`dnd` salen de `data.chat.calls`
  (`users/preferences.json`, resuelto por usuario). `dnd` suprime el push.
- **Estado en memoria** (como en Tolqia). Un reinicio del backend olvida el
  registro: la llamada sigue viva en el navegador (el socket es directo), pero el
  mensaje de sistema ya no se puede persistir — el SSE sí sale, así que la UI
  cierra bien.

### Env

`CALL_ENABLED`, `TOLQIA_URL`, `TOLQIA_SERVICE_SECRET`, `TOLQIA_WEBHOOK_SECRET`,
`TOLQIA_PUBLIC_PATH`, `CALL_RING_TIMEOUT_MS` (ver `config/env.ts` y
`.env.example`). Los dos secretos deben coincidir con `tolqia/server/.env`.
`CREDENTIAL_VAULT_KEY` cifra además el token de la cuenta de Tolqia: si cambia
sin re-emitirla, el servidor se comporta como **no enlazado** (degrada, no
revienta) y el admin vuelve a pegar el token.

## Tests

`services/chat.recipients.test.ts` (mapeo de destinatarios + presencia),
`services/chat.view.test.ts` (nombres visibles: vista, mensajes, título de push),
`services/chat.attachments.test.ts` (listado, join de tamaño, borrados, gate),
`services/directory.service.test.ts` (gate de privacidad, `displayNames` con
caché y fail-open, miembros de grupo con presencia/estado),
`controllers/attachment-headers.test.ts` (allowlist, firmas, Range 206/416,
saneado de nombre), `services/tolqia-bridge.test.ts` (contrato 201/409/500,
HMAC correcto/incorrecto/replay/cuerpo manipulado, dedupe, mensaje de sistema,
SSE, `dnd`, caché de `getActiveCall`, transcripción por webhook / por fallback
GET / fail-open / cap, y `getCallTranscript`) `services/tolqia-account.test.ts` (formato del token, cifrado en reposo y
degradación ante un payload que no descifra, validación en `PUT`, caché de 5 min,
`test()` y `plan()` sin fugas) y `src/test/integration/preferences-chat.test.ts`.
En el frontend, `components/messenger/call/tolqia-plan.test.ts`.
