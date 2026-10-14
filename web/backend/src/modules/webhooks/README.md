# Webhooks Module

Outbound webhook subscriptions and API key management for machine-to-machine access.

## Endpoints

### Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/webhooks/events` | Admin | List supported event types |
| GET | `/api/webhooks` | Admin | List configured webhooks |
| POST | `/api/webhooks` | Admin + CSRF | Create a webhook |
| PUT | `/api/webhooks/:id` | Admin + CSRF | Update a webhook (URL, events, enabled) |
| POST | `/api/webhooks/:id/regenerate-secret` | Admin + CSRF | Rotate HMAC signing secret |
| GET | `/api/webhooks/:id/deliveries` | Admin | Last 30 delivery outcomes |
| POST | `/api/webhooks/:id/test` | Admin + CSRF | Send a signed `webhook.test` event |
| DELETE | `/api/webhooks/:id` | Admin + CSRF | Delete a webhook |

### Discovery (webhooks detected on the server)

Surfaces webhook-shaped configuration that already exists on the connected
client server — not just the panel-native ones — so they can be reviewed and
(where safe) managed. Discovery is an **on-demand scan** over the active
target's `Executor` (no persistence), mirroring the Files module's project
scan. Detectors are fail-soft and run concurrently.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/webhooks/discovered` | Admin | Scan & list webhooks found on the server |
| POST | `/api/webhooks/discovered/scan` | Admin + CSRF | Explicit (re)scan |
| POST | `/api/webhooks/discovered/action` | Admin + CSRF | Manage a discovered item: `{ id, op: "delete"\|"enable"\|"disable" }` |

**Sources** (`DiscoveredWebhook.source`):

| Source | What it finds | Manageable here |
|--------|---------------|-----------------|
| `sidecar` | Panel-native outbound webhooks (the `webhooks` store) | Full CRUD |
| `git-hook` | Executable scripts under `<repo>/.git/hooks` | enable/disable (`chmod ±x`), delete (`unlink`) |
| `nginx` | Incoming receiver endpoints (`location`/`proxy_pass`) in nginx sites | Read-only (manage in NGINX module) |
| `cron` | `/etc/crontab` + `/etc/cron.d/*` lines that curl/wget a URL | Read-only |
| `systemd` | Unit `ExecStart` lines hitting a webhook URL | Read-only |
| `config` | Webhook URLs in `/etc` app/system config files | Read-only |
| `project` | Webhook refs inside Files-module Git projects (`.github/workflows`, `.env`/config) | Read-only |

Each detector lives in `services/discovery/<source>.detector.ts` and implements
`WebhookDetector` (`services/discovery/types.ts`); the orchestrator
(`services/discovery/index.ts`) runs them with `Promise.allSettled`, dedupes by
a stable `makeDiscoveryId(source, location, target)` and sorts. Read-only
sources return a `400` from `/action` pointing the admin to the owning module.

### API Keys

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/api-keys` | Admin | List all API keys (secret not shown after creation) |
| POST | `/api/api-keys` | Admin + CSRF | Create an API key |
| DELETE | `/api/api-keys/:id` | Admin + CSRF | Revoke an API key |

## Webhook Payload

Every webhook delivery sends a `POST` to the configured URL with:

```http
POST https://hooks.example.com/luxipanel
Content-Type: application/json
X-LuxiPanel-Event: mail.account.created
X-LuxiPanel-Signature: sha256=<hmac-hex>

{
  "event": "mail.account.created",
  "ts": 1712345678000,
  "data": { ... }
}
```

### Signature verification

```javascript
const body = JSON.stringify(payload);
const sig = crypto
  .createHmac("sha256", webhookSecret)
  .update(body)
  .digest("hex");

const expected = `sha256=${sig}`;
const received = req.headers["x-luxipanel-signature"];

// Constant-time comparison:
crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
```

## Supported Events

| Event | Description |
|-------|-------------|
| `mail.account.created` | New mail account created |
| `mail.account.deleted` | Mail account deleted |
| `user.created` | New panel user created |
| `user.deleted` | Panel user deleted |
| `backup.completed` | Backup job finished successfully |
| `backup.failed` | Backup job failed |
| `ssl.cert.issued` | HTTPS certificate issued through NGINX |
| `cloudflare.dns.changed` | DNS record changed |
| `cloudflare.cache.purged` | Cache purge requested |
| `alert.firing` | Monitor alert rule fired |
| `alert.resolved` | Monitor alert rule resolved |

## Delivery Retries

Failed deliveries (non-2xx response or timeout) are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 5 seconds |
| 3 | 15 seconds |
| 4 | 30 minutes |
| 5 | 2 hours |

After 5 failures the webhook is marked `status: "failing"`. It continues to receive events but is flagged for admin attention.

## API Keys

API keys provide an alternative to JWT session cookies for programmatic access:

- Format: `lxp_<32-char-random-hex>` (shown once on creation)
- Stored as SHA-256 hash in the DB — the plaintext is never stored
- Pass via `Authorization: Bearer lxp_...` header
- Can be scoped to specific modules and given an optional expiry date
- Validated by `api-key.service.ts` on each request that carries this header

## Services

| Service | Purpose |
|---------|---------|
| `webhook-dispatcher.service.ts` | HTTP delivery with retry queue, HMAC signing |
| `api-key.service.ts` | Key generation (`lxp_` prefix), SHA-256 hashing, validation |

## Architecture

```
webhooks module
├── controllers/
│   ├── webhooks.controller.ts     ← CRUD, regenerate-secret, events list
│   └── api-keys.controller.ts     ← create, list, revoke
├── services/
│   ├── webhook-dispatcher.service.ts  ← deliver(), retry logic, HMAC
│   └── api-key.service.ts             ← generate(), validate(), hash()
├── repositories/
│   ├── webhook.repository.ts
│   └── api-key.repository.ts
└── index.ts                       ← eventBus listeners → dispatcher.dispatch()
```
