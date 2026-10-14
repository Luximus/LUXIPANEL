# `shared/remote-cache` — Per-target Redis cache reader

Lee la cache que viven los **engines en cada servidor de cliente** (Hito 2)
y la sirve al panel de forma **read-through con fallback transparente**.

## Cómo lo usan los controllers

El patrón canónico:

```ts
import { serveCachedDataTable } from "@shared/remote-cache/serve-cached-datatable";

list: asyncHandler(async (req, res) => {
  const executor = getExecutor(req);
  const cached = await serveCachedDataTable<Row>({
    executor,
    module: "users",
    collection: "system",
    liveLoader: () => readLinuxUsersFromServer(req),  // misma forma de respuesta
  });
  res.json({ ok: true, data: cached.rows });
});
```

El `liveLoader` debe devolver **EXACTAMENTE la misma shape** que el engine
produce (revisar `cacheable-modules.ts` proyección + collector Python).
Así cache hit y miss son interchangeable byte-a-byte.

## Para repos basados en kv-store

No requieren wrapper — `dataStore.list/query/find` ya pasan por cache
automáticamente. Solo asegúrate que `(module, collection)` esté en
`@shared/cache/cacheable-modules.ts`.

```ts
// notification.repository.ts
const items = await dataStore<Notif>(executor, "notifications", "notifications").list();
// → si está en allowlist, primero intenta cache; fallback al sidecar SFTP.
```

## Cuándo el cache devuelve `null`

Todos estos casos caen a `liveLoader` SIN error:
- `conn.json` ausente (target sin cache stack provisionado)
- Circuit breaker abierto (3 fallos consecutivos)
- `redis-cli` exec timeout (default 2000ms)
- Payload `collectedAt` más viejo que `REMOTE_CACHE_VERY_STALE_SECONDS`
- Parse error del blob
- `forceLive: true` explícito

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  Panel (LUXIPANEL backend)                                       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Controller .list()                                       │    │
│  │      ↓                                                    │    │
│  │  serveCachedDataTable                                     │    │
│  │      ↓                                                    │    │
│  │  index.ts.getCachedFull                                   │    │
│  │      ├─ panel-meta lookup (Redis local panel)             │    │
│  │      │      key = panel:rc:<targetId>:<m>:<c>             │    │
│  │      │      stores ONLY {version,count,collectedAt}       │    │
│  │      │      NO tenant payload here                        │    │
│  │      └─ blob fetch (executor.exec → context Executor (local/direct SSH))     │    │
│  │             redis-cli GET lprc:v1:<m>:<c>:full            │    │
│  │             gunzip + JSON.parse                           │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (mTLS keep-alive)
┌─────────────────────────────────────────────────────────────────┐
│  LP-LICENSE-SERVER (gateway agents)                              │
│  context Executor (local/direct SSH) → pooled SSH connection                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (pooled SSH)
┌─────────────────────────────────────────────────────────────────┐
│  Cliente (servidor del usuario)                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Redis dedicado luxipanel-cache (127.0.0.1, alimentado   │    │
│  │  por engines)                                             │    │
│  │      ↑                                                    │    │
│  │  Engine python: collector-<modulo>.py + engine-mirror.py │    │
│  │  Dispatcher: systemd-timer cada 60s + flock/nice         │    │
│  │  Reads: /etc/postfix/* /etc/dovecot/* /etc/nginx/*       │    │
│  │         certbot certificates, getent, du, etc.           │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Invariantes

- **Cero datos del tenant en el host del panel**: el panel-meta solo
  guarda `{version,count,collectedAt}` por target. El blob completo vive
  exclusivamente en el Redis del servidor del cliente.
- **Per-target isolation**: cada cliente tiene su propio Redis dedicado
  en `127.0.0.1`. Las claves nunca se mezclan entre tenants — la
  instancia Redis ES la frontera.
- **Fail-open en todos los caminos**: el cache nunca rompe la app. Un
  fallo siempre se traduce a "usar live loader".
- **Allowlist única**: cambios al universo de qué se cachea van por
  `@shared/cache/cacheable-modules.ts`. Default = NO cacheable.
- **Fidelidad 1:1**: collectors Python reproducen exactamente lo que el
  TS controller emitiría. Hit y miss son intercambiables.

## Archivos

| Archivo | Rol |
|---|---|
| `index.ts` | `getCachedFull` / `getCachedPage` con breaker + SWR + panel-meta |
| `serve-cached-datatable.ts` | Wrapper canónico para controllers |
| `read-through.ts` | `listCached` — usado por `dataStore.list/query/find` |
| `refresh.ts` | `scheduleRefresh` — refresh-on-write con coalescing |
| `event-bridge.ts` | Mapea eventos del bus a refresh (cross-cutting) |
| `conn.ts` | Lee `conn.json` por SFTP, memoiza por target |
| `metrics.ts` | Contadores in-memory (hit/miss/error/...) |

## Tests

```bash
npx vitest run src/shared/cache src/shared/remote-cache
```

50+ tests cubren: allowlist invariants, cache hit/miss, breaker, SWR,
isolation cross-server, refresh-on-write, forceLive, event-bridge.
Test integration `integration-mail-accounts.test.ts` ejercita el full
flow contractual.
