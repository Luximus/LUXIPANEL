# Cloudflare module

Manages the Cloudflare account tied to the **connected server**: zones, DNS
records, cache purging, a small whitelist of zone settings and IP access
rules — all through the official Cloudflare v4 REST API.

## Design

- **Only persisted state = the API token**, stored via `settingsRepository`
  (category `cloudflare`, key `cloudflare_api_token`) on the connected
  server's settings sidecar (openclaw pattern). The raw token is never
  returned to the browser (masked preview only) and never logged.
- **API client is pure HTTP** (`cloudflare-api.service.ts`): native `fetch`,
  `Authorization: Bearer <token>`, 10s `AbortController` timeout per request,
  and the standard `{ success, errors, result, result_info }` envelope.
  `success:false` → `AppError(502, "CLOUDFLARE_API_ERROR")` with the first
  Cloudflare error message. Paginated lists (zones per_page=50, DNS
  per_page=300, access rules per_page=100) loop `total_pages` with a hard cap
  of 10 pages.
- **pointsToServer annotation**: the DNS listing probes the public IP of the
  CONNECTED server through the `Executor` (`curl api.ipify.org` →
  `curl ifconfig.me` → `dig @resolver1.opendns.com`, format-validated) and
  marks records whose content equals it. The probe never throws — on failure
  `serverIp` is `null` and no record is marked.
- Zone settings are whitelisted per setting (`ssl`, `always_use_https`,
  `security_level`, `development_mode`) — values outside the whitelist are
  rejected by Zod before reaching Cloudflare.

## Structure

```
cloudflare/
├── models/index.ts                        # types + Zod schemas + IP helpers
├── services/cloudflare-config.service.ts  # token storage (settingsRepository)
├── services/cloudflare-api.service.ts     # pure CF v4 HTTP client
├── services/cloudflare.service.ts         # orchestration (token + API + server IP)
├── services/ssl-suggestion.service.ts     # SSL_ISSUED listener → SSL-mode suggestion
├── services/cloudflare-api.service.test.ts
├── controllers/cloudflare.controller.ts
├── routes/cloudflare.routes.ts
├── agent-capability.ts                    # AI assistant tools (cloudflare.*)
└── index.ts                               # registerCloudflareModule(app)
```

> **No `repositories/` layer.** The module keeps no per-server `dataStore`
> collection: its only persisted state is the API token (via the shared admin
> `settingsRepository`). Zones / DNS / rules are read live from the Cloudflare v4
> API on every call, never mirrored into a sidecar — so there is nothing for a
> repository to wrap.

## Endpoints

All under `requireAuth` + `requireModule("cloudflare")` (path-scoped). Every
mutation is CSRF-guarded.

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/cloudflare/config` | Token presence + masked preview |
| PUT    | `/api/cloudflare/config` | Save API token |
| DELETE | `/api/cloudflare/config` | Delete API token |
| POST   | `/api/cloudflare/test` | Verify token (`/user/tokens/verify`) |
| GET    | `/api/cloudflare/server-ip` | Public IP of the connected server |
| GET    | `/api/cloudflare/zones` | List zones |
| GET    | `/api/cloudflare/zones/:zoneId/settings` | ssl / alwaysUseHttps / securityLevel / developmentMode |
| PATCH  | `/api/cloudflare/zones/:zoneId/settings` | Change one whitelisted setting |
| GET    | `/api/cloudflare/zones/:zoneId/dns` | DNS records + `pointsToServer` + `serverIp` |
| POST   | `/api/cloudflare/zones/:zoneId/dns` | Create record |
| PATCH  | `/api/cloudflare/zones/:zoneId/dns/:recordId` | Update record (partial) |
| DELETE | `/api/cloudflare/zones/:zoneId/dns/:recordId` | Delete record |
| POST   | `/api/cloudflare/zones/:zoneId/purge` | Purge cache (`everything` or up to 30 `files`) |
| GET    | `/api/cloudflare/zones/:zoneId/access-rules` | List IP access rules |
| POST   | `/api/cloudflare/zones/:zoneId/access-rules` | Create rule (block/whitelist/challenge; `ip`/`ip_range` auto) |
| DELETE | `/api/cloudflare/zones/:zoneId/access-rules/:ruleId` | Delete rule |

Errors: missing token → `409 CLOUDFLARE_TOKEN_MISSING`; Cloudflare API
failure → `502 CLOUDFLARE_API_ERROR`.

## Agent tools

`cloudflare.status`, `cloudflare.list_zones`, `cloudflare.list_dns_records`
(zone by name or id), `cloudflare.create_dns_record`,
`cloudflare.update_dns_record`, `cloudflare.delete_dns_record`,
`cloudflare.purge_cache`, `cloudflare.get_zone_settings`,
`cloudflare.set_zone_setting`, `cloudflare.list_access_rules`,
`cloudflare.block_ip`. Mutating tools are `action` + `dangerous`. Handlers
wrap settings access in `runWithExecutor(requireExecutor(), ...)`.

## Integraciones

El módulo se integra con el resto del panel **solo vía event bus**
(`shared/events`) — nunca importa otros módulos (p.ej. jamás importa
`notificationsService`).

**Eventos emitidos** (en el controller, tras cada mutación exitosa — mismo
patrón que `nginx/ssl-bridge.controller.ts`):

| Evento | Cuándo | Payload |
|---|---|---|
| `CLOUDFLARE_DNS_CHANGED` | create/update/delete de registro DNS | `{ zoneId, action: "created"\|"updated"\|"deleted", type?, name? }` (en delete solo `zoneId`+`action`; `zoneName` se omite porque exigiría un round-trip extra) |
| `CLOUDFLARE_PURGED` | purga de caché de zona | `{ zoneId, everything: boolean, files: number }` |
| `CLOUDFLARE_ACCESS_RULE_ADDED` | creación de regla de acceso | `{ zoneId, mode, ip }` |
| `CLOUDFLARE_SSL_MODE_SUGGESTED` | ver listener abajo | `{ domain, zoneId, zoneName, currentMode }` |

**Listener `SSL_ISSUED`** (`services/ssl-suggestion.service.ts`,
`wireCloudflareSslSuggestion()` desde `index.ts`): cuando el bridge de NGINX
emite un certificado, busca la zona CF cuyo `name` sea sufijo del dominio
(match más largo); si su setting `ssl` es `flexible` u `off`, emite
`CLOUDFLARE_SSL_MODE_SUGGESTED` (la notificación sugiere subir a Full
(strict)). Totalmente fail-safe: `eventBus.emit` es síncrono, así que el
handler hereda el contexto ALS del request emisor (el token se resuelve con el
executor del servidor conectado); sin token / API caída / sin zona → return
silencioso, fire-and-forget, nunca lanza ni loguea el token.

**Consumidores de los eventos:**

- `notifications` (`wireInternalNotifications`): campana para los 4 eventos
  con deep links a `/panel/cloudflare` (la sugerencia SSL apunta a
  `/panel/cloudflare?tab=security`).
- `webhooks`: `cloudflare.dns.changed` y `cloudflare.cache.purged` son
  suscribibles por endpoints externos (`WEBHOOK_EVENTS`).
- `dashboard`: widget `cloudflare` (gateado por el permiso de sidebar, sin
  stat — las zonas CF no viven en el Redis per-server).

## Enabling

Not in `DEFAULT_ENABLED_MODULES` (like `databases`): the admin toggles it in
`/panel/modules`.
