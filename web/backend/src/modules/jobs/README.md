# Módulo `jobs` — estado de la cola write-behind

Endpoint de **solo lectura** para sondear el estado de una mutación encolada en
la cola write-behind (`lpwq:v1:*`) del Redis **por-servidor** del cliente. Lo
usa el frontend (`lib/job-poll.ts` → `awaitJob`) tras un crear/editar/eliminar
que devolvió `job:{ id, mode }` con `mode !== "applied"`: sondea hasta `done`/
`failed` y solo entonces recarga el DataTable. Ver CLAUDE.md §"Escritura
(write-behind)".

## Contrato

| Método | Ruta | Auth | Acción |
|---|---|---|---|
| GET | `/api/jobs/:id` | `requireAuth` | Estado actual de una mutación encolada |

- **Sin gate por-módulo:** el `:id` es un uuid opaco acotado al servidor
  conectado del llamante y el payload de estado no lleva datos de tenant más
  allá del propio estado del job.
- **Gate de forma del id:** `:id` debe casar `/^[0-9a-fA-F-]{8,64}$/`; si no →
  `404 NotFoundError` (nunca se pasa entrada arbitraria a la cache remota).

## Respuesta

- `readJobStatus === null` (clave expirada, nunca existió o Redis inalcanzable)
  → `200 { ok:true, data:{ jobId, state:"unknown" } }` — la UI **deja de sondear**
  con elegancia en vez de recibir un 404.
- Con estado real → `200 { ok:true, data:<status> }` (passthrough).

## Watchdog STUCK

Si un job sigue en `state:"queued"` pasado `WRITE_QUEUE_STUCK_MS` (el worker
on-box probablemente está muerto en ese servidor), emite **una sola vez** por
`(targetId, jobId)` el evento `Events.WRITE_QUEUE_STUCK` (de-dupe con un `Set`
acotado a `STUCK_NOTIFIED_CAP=5000`, evicción FIFO). El cableado a
notificaciones vive en `wireInternalNotifications`.

## Anatomía / capas

Módulo **thin**: solo `controllers/` + `routes/`. Sin `models/`/`repositories/`
propios (lee vía `shared/remote-cache/submit-mutation#readJobStatus`) y sin
servicio propio. **Sin agent-capability (MCP):** no expone herramientas al
asistente IA; es infraestructura de sondeo interna del frontend.

## Tests

`src/test/integration/jobs.test.ts` — fija: 401 sin sesión, gate de forma del id
(404), `state:"unknown"` en null, passthrough del estado y el de-dupe del
watchdog STUCK.
