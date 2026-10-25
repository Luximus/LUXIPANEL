// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Environment validation — fail-fast if required variables are missing.
 *
 * All env vars are validated at boot through a Zod schema so every module
 * can trust the shape of the config at runtime without extra checks.
 */

import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

/** Default frontend origin used in dev for CORS + WebAuthn RP origin. */
const DEV_FRONTEND_ORIGIN = "http://localhost:4321";

const commaSep = z
  .string()
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean));

const boolStr = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

/** Like boolStr but defaults to true when the variable is absent. */
const boolStrTrue = z
  .enum(["true", "false", "1", "0", ""])
  .default("true")
  .transform((v) => v !== "false" && v !== "0");

const envSchema = z.object({
  // --- Server ---
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LUXIPANEL_GITHUB_TOKEN: z.string().default(""),
  LUXIPANEL_INSTALL_ROOT: z.string().default(""),

  // --- Database ---
  // DATABASE_URL/POOL/SSL are intentionally REMOVED. LUXIPANEL persists
  // everything as JSON sidecars on the connected server (see `kv-store` +
  // `LUXIPANEL_CONFIG_DIR`).
  /** Local env file used only for read-only lookup of Luxisoft project chats. */
  LUXISOFT_CHAT_DATABASE_ENV_FILE: z.string().default("/var/www/luxisoft/backend/.env"),

  // --- Redis ---
  REDIS_URL: z.string().default("redis://localhost:6379/0"),
  /** Loopback port of the per-target client-cache Redis (lprc/lpwq engines).
   *  Kept as a string here (optional) and parsed into `CACHE_REDIS_PORT`. */
  LUXIPANEL_CACHE_PORT: z.string().optional(),

  // --- CORS ---
  CORS_ORIGIN: z.string().default(DEV_FRONTEND_ORIGIN),
  CORS_CREDENTIALS: boolStr,

  // --- Cache Control ---
  DISABLE_HTTP_CACHE: boolStr.default("true"),

  // --- Auth ---
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("24h"),
  JWT_REMEMBER_EXPIRES_IN: z.string().default("30d"),
  /** Lifetime of the PARTIAL (MFA-pending) JWT minted after password success but
   *  before the 2FA step. Same "24h"/"30d"/"5m" duration syntax as the other JWT
   *  TTLs (parsed via token.service `parseDuration`). Default 5 minutes. */
  JWT_PARTIAL_EXPIRES_IN: z.string().default("5m"),
  // AES-256-GCM master key for the MCP secret vault (modules/mcp secret-manager
  // derives a per-record key from it via scrypt). REQUIRED in production (see
  // superRefine below); outside prod it may be absent — the MCP encrypt/decrypt
  // path keeps a runtime guard. Min 32 chars when present.
  ENCRYPTION_KEY: z.string().min(32).optional(),
  COOKIE_DOMAIN: z.string().default(""),
  // Dominios "wildcard" heredados que deben PURGARSE al emitir/limpiar la
  // cookie de sesión. Con COOKIE_DOMAIN vacío las cookies son host-only (una
  // sesión independiente por subdominio), pero un navegador que aún tenga la
  // cookie vieja en `.luxipanel.com` la enviaría junto con la host-only y, al
  // compartir nombre, el backend leería la vieja → "se queda en el servidor
  // anterior". Emitimos un clearCookie para cada uno de estos dominios para
  // borrar la cookie compartida. CSV; default cubre la migración de luxipanel.
  COOKIE_LEGACY_DOMAINS: z.string().default(".luxipanel.com"),
  // Session cookie attributes. COOKIE_SECURE defaults to TRUE so production
// deployments only ship a Secure cookie; local dev can opt out by setting
// COOKIE_SECURE=false in .env. The SameSite default of "lax" keeps the cookie
// attached to top-level navigations (necessary for OAuth callbacks / SSO
// handoff) while still blocking cross-site POSTs.
COOKIE_SECURE: boolStrTrue,
  COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("lax"),
  SESSION_COOKIE_NAME: z.string().default("luxipanel_session"),
  CSRF_COOKIE_NAME: z.string().default("luxipanel_csrf"),
  // --- Rate Limiting ---
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

  // --- hCaptcha ---
  HCAPTCHA_ENABLED: boolStr,
  HCAPTCHA_SECRET: z.string().default(""),
  HCAPTCHA_SITEKEY: z.string().default(""),

  // --- WebAuthn ---
  WEBAUTHN_RP_NAME: z.string().default("LUXIPANEL"),
  WEBAUTHN_RP_ID: z.string().default("localhost"),
  WEBAUTHN_ORIGIN: z.string().default(DEV_FRONTEND_ORIGIN),

  // --- Mail ---
  DOVECOT_USERS_FILE: z.string().default("/etc/dovecot/users"),
  DOVECOT_GROUP: z.string().default("dovecot"),
  VMAIL_BASE: z.string().default("/var/vmail"),
  VMAIL_UID: z.coerce.number().int().default(5000),
  VMAIL_GID: z.coerce.number().int().default(5000),
  SIEVEC_BIN: z.string().default("/usr/bin/sievec"),
  POSTFIX_VMAILBOX: z.string().default("/etc/postfix/vmailbox"),
  MAIL_ENCRYPTION_KEY: z.string().default(""),
  MAIL_IMAP_HOST: z.string().default("localhost"),
  MAIL_IMAP_PORT: z.coerce.number().int().positive().default(993),
  MAIL_IMAP_FALLBACK_HOSTS: commaSep.default(""),
  MAIL_SMTP_HOST: z.string().default("localhost"),
  MAIL_SMTP_PORT: z.coerce.number().int().positive().default(587),

  /** Public base URL of the panel (e.g. https://panel.example.com) — used to
   *  build absolute links in system emails (cron approval URLs). */
  PANEL_PUBLIC_URL: z.string().default(""),

  // --- License ---
  LICENSE_SERVER_URL: z.string().default("https://api.luxisoft.com"),
  // Internal base URL used for SSH-proxy agent API calls (/api/agents/*).
  // Defaults to LICENSE_SERVER_URL but can be set to an internal address
  // (e.g. http://127.0.0.1:3300) to bypass Cloudflare and stay within the
  // IP allowlist that LP-LS enforces on agent endpoints.
  LICENSE_SERVER_AGENTS_URL: z.string().default(""),
  LICENSE_SERVER_TLS_CLIENT_CERT_PEM: z.string().default(""),
  LICENSE_SERVER_TLS_CLIENT_KEY_PEM: z.string().default(""),
  LICENSE_SERVER_TLS_CA_PEM: z.string().default(""),
  /** Explicit override path for the branding-asset URL map persisted on the
   *  panel host (license/branding-asset.service). Absent → cascades through
   *  ${LUXIPANEL_CONFIG_DIR}/branding-assets.json then ${HOME}/.luxipanel/… . */
  BRANDING_ASSET_FILE: z.string().optional(),
  // (LICENSE_SERVER_TLS_REJECT_UNAUTHORIZED removed: it was inert — verification
  // of LP's PUBLIC cert against the system trust store is now a hardcoded
  // invariant in license-server-tls.ts. See CLAUDE.md §Transporte.)

  // --- Operation mode ---
  // LUXIPANEL is self-hosted, single-node ("standalone"): the panel manages the
  // very server it runs on (via `localExecutor`) and any additional nodes it
  // reaches over direct SSH (the `servers` module vault). There is no managed
  // LP-LICENSE-SERVER mode anymore — `OPERATION_MODE`/`MANAGED_BY_LICENSE_SERVER`
  // and the `isManaged()/isStandalone()` helpers were removed.
  // Shared secret used to authenticate server-to-server calls from this
  // LUXIPANEL instance to the SSH Proxy API of LP-LS. Bootstrap value: una
  // vez recibido el primer push de rotación desde LP-LS, el valor activo
  // pasa a estar gestionado por shared-secret-store (en disco). El env queda
  // como fallback de bootstrap si el store está vacío.
  LUXIPANEL_KEY: z.string().default(""),
  /** Explicit override path for the shared-secret rotation store
   *  (secret-rotation module). Absent → the store cascades through
   *  ${LUXIPANEL_CONFIG_DIR}/shared-secrets.json then ${HOME}/.luxipanel/…. */
  SECRET_ROTATION_FILE: z.string().optional(),
  // Per-call timeout when invoking /api/agents/exec or /api/agents/sftp/* on LP-LS.
  SSH_PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  // Root domain for dynamic subdomains (paneles externos: <accessCode>.<root>).
  PANEL_ROOT_DOMAIN: z.string().default("luxipanel.com"),

  // --- Worklog (significant-activity log) ---
  // Buffers significant user activity (mutations, deploys, notable commands —
  // never page views) in the panel-host Redis. Defaults OFF: the flusher that
  // used to drain the buffer (LP-LS worklog push) was retired, so with no
  // consumer the buffer would only fill and expire. Fully fail-open.
  WORKLOG_ENABLED: boolStr,

  // --- Jailed shell (Track 2 — interactive PTY chroot via jailkit) ---
  /** Master switch for the per-account jailed login shell. When false the
   *  interactive PTY always falls back to the normal `sudo -u <owner> -H <shell>`
   *  path (= current behavior). Track 1 (panel ops: exec/readFile/… via
   *  `sudo -u owner sh -c`) is NEVER affected by this flag. */
  JAIL_SHELL_ENABLED: boolStr,
  /** Absolute path to the jailkit chroot login shell on the CLIENT server. It
   *  becomes the owner's login shell once `jk_jailuser` runs; `sudo -u owner -i`
   *  then drops the PTY into the jail. */
  JAIL_TOOL_PATH: z.string().default("/usr/sbin/jk_chrootsh"),
  /** Fail-closed: exige la jaula chroot para TODA terminal `kind:"hosting"`,
   *  con independencia del opt-in por cuenta (`account.jailEnabled`) o de
   *  `JAIL_SHELL_ENABLED`. Es la frontera de aislamiento de shell del producto
   *  multi-tenant: si no se confirma `jk_chrootsh`, no se abre PTY. Ponlo en
   *  `false` SOLO con una política explícita por servidor (entornos sin
   *  multi-tenant real); al hacerlo, una shell hosting sin jaula queda auditada
   *  (WARN). Default `true`. */
  HOSTING_TERMINAL_REQUIRE_JAIL: boolStrTrue,

  // --- Web Terminal ---
  TERMINAL_ENABLED: boolStr,
  TERMINAL_MAX_SESSIONS: z.coerce.number().int().min(1).max(50).default(5),
  TERMINAL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30 * 60 * 1000),
  TERMINAL_SHELL: z.string().default("/bin/bash"),

  // --- Per-server config dir (resolved on the CONNECTED server, not on
  //     the panel host). All settings, users, roles, audit logs, etc. live
  //     in JSON sidecars under this path on whichever Linux server the
  //     current session is bridged to. Each server has its own copy. ---
  LUXIPANEL_CONFIG_DIR: z.string().default("/etc/luxipanel"),

  // --- Server-alerts module (módulo server-alerts) ---
  /** Si está activo, el worker de server-alerts corre periódicamente para
   *  disparar notificaciones programadas y evaluar reglas por métricas. */
  SERVER_ALERTS_WORKER_ENABLED: boolStrTrue,
  /** Periodo del worker de server-alerts (ms). Mínimo razonable 30s. */
  SERVER_ALERTS_WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),

  // --- SSH-based login (validate panel users by SSH-ing into the managed server) ---
  SSH_LOGIN_HOST: z.string().default("127.0.0.1"),
  SSH_LOGIN_PORT: z.coerce.number().int().positive().max(65535).default(22),
  /** Path to the panel-side SSH private key used for login validation. Encrypted with the user-supplied passphrase. */
  SSH_LOGIN_KEY_PATH: z.string().default("/etc/luxipanel/ssh/server_key"),
  SSH_LOGIN_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  /** Unprivileged account the local PAM login validator drops `su` to so a
   *  root-running panel can't use su's root bypass (see local-auth.service). */
  LOCAL_AUTH_DROP_USER: z.string().default("nobody"),

  // --- Remote cache (per-target Redis fed by client-side engines) ---
  /** A DataTable response is "fresh" when its `collectedAt` is younger than
   *  this many seconds — served directly from the cache. */
  REMOTE_CACHE_FRESH_SECONDS: z.coerce.number().int().positive().default(600),
  /** Between FRESH and VERY_STALE the response is served as
   *  stale-while-revalidate; beyond it we fail-open to the JSON path. */
  REMOTE_CACHE_VERY_STALE_SECONDS: z.coerce.number().int().positive().default(3600),
  /** Consecutive failures (exec error / parse / Redis down) that open the
   *  per-target circuit breaker. */
  REMOTE_CACHE_BREAKER_THRESHOLD: z.coerce.number().int().positive().default(3),
  /** How long the breaker stays open after tripping (ms). */
  REMOTE_CACHE_BREAKER_OPEN_MS: z.coerce.number().int().positive().default(30_000),
  /** Hard cap on a single `redis-cli` exec over /api/agents/exec (ms). */
  REMOTE_CACHE_EXEC_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),
  /** TTL (seconds) of the meta-only entry in the PANEL-LOCAL Redis. Holds
   *  only `{version,count,collectedAt}` keyed by target.id — never tenant
   *  payload — so a quick conditional check can decide "unchanged → reuse"
   *  without touching the client server. */
  REMOTE_CACHE_PANEL_META_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  /** TTL (seconds) of a cached directory listing in the per-target Redis.
   *  Short by design: filesystems are volatile, and panel-driven mutations
   *  invalidate the affected dirs immediately — this TTL only bounds drift
   *  from out-of-band changes (cron, ssh, builds) that the panel never sees. */
  FILES_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  /** TTL (seconds) for a cached recursive directory size. Longer than the
   *  listing TTL because total bytes drift slowly even with frequent writes. */
  FILES_DIRSIZE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  /** TTL (seconds) for cached file contents. Short by design — content can
   *  change out-of-band; panel writes invalidate immediately. */
  FILES_CONTENT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  /** Hard cap (bytes) for content caching. Files larger than this are read
   *  live every time. 256 KiB covers virtually all editable config/code files
   *  while keeping Redis memory bounded. */
  FILES_CONTENT_CACHE_MAX_BYTES: z.coerce.number().int().positive().default(262_144),
  /** Hard cap (bytes) for reading a file into the inline editor. `sftp.readFile`
   *  buffers the whole file and the UTF-8 conversion doubles memory, so a
   *  multi-GB file would OOM the panel. Files bigger than this are rejected with
   *  413 (stat-checked before the read). 8 MiB comfortably covers any editable
   *  config/code file. */
  FILES_EDITOR_MAX_BYTES: z.coerce.number().int().positive().default(8_388_608),
  /** TTL (seconds) for cached file stat (mtime/mode/size/owner/permissions).
   *  Matches the listing TTL so stat and list never disagree for long. */
  FILES_STAT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  /** TTL (seconds) for cached recursive search results. Invalidation by
   *  query is impractical — TTL is the only freshness guarantee. */
  FILES_SEARCH_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  /** Hard cap (bytes) for a single file upload (`POST /api/files/upload`). This
   *  is BOTH the `express.raw()` body limit on the route AND the controller's
   *  guard, so exceeding it fails fast with a typed 413 (`PAYLOAD_TOO_LARGE`)
   *  before any write. NOTE: `express.raw` buffers the whole body in memory on
   *  the panel host before it streams to the connected server over SFTP, so this
   *  is bounded by panel RAM — raise it deliberately. Default 512 MiB comfortably
   *  covers typical `.zip`/media uploads (the old limit was a hardcoded 10 MB,
   *  which silently rejected any modest archive). */
  FILES_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(536_870_912),

  // --- Files "safe changes" snapshots (Fase 0.1 — pre-mutation backups) ---
  /** Master switch for automatic mini-snapshots before edit/delete/move/
   *  replace. When false the capture hook is a no-op (the FS op still runs). */
  FILES_SNAPSHOTS_ENABLED: boolStrTrue,
  /** Hard cap (bytes) for what gets captured into a snapshot blob. Files (or
   *  the tar.gz of a directory) bigger than this are recorded as metadata only
   *  (kind="skipped") so a single huge file can't fill the client's disk. */
  FILES_SNAPSHOT_MAX_BYTES: z.coerce.number().int().positive().default(5_242_880),
  /** Retention: max snapshots kept per distinct path (oldest pruned first). */
  FILES_SNAPSHOT_MAX_PER_PATH: z.coerce.number().int().positive().default(20),
  /** Retention: global cap on snapshot records per server (oldest pruned). */
  FILES_SNAPSHOT_MAX_TOTAL: z.coerce.number().int().positive().default(500),
  /** AES-256-GCM key (64 hex chars) for encrypting per-project Git credentials
   *  (PAT / SSH key) at rest. Lives ONLY on the panel host; the per-server
   *  sidecar stores ciphertext. Empty → Git push/pull credential features are
   *  disabled (status/commit/local ops still work). */
  GIT_ENCRYPTION_KEY: z.string().default(""),

  // --- Write-behind queue (lpwq:* — per-target Redis drained by worker.py) ---
  /** Master switch. When false, every module routes mutations through the
   *  legacy synchronous SSH path (safety kill-switch). */
  WRITE_QUEUE_ENABLED: boolStrTrue,
  /** Ceiling (ms) the panel waits for the worker to finish after enqueuing.
   *  It returns the INSTANT the job signals done (BLPOP wakes), so fast ops
   *  aren't penalised; only slow ones (e.g. mail, whose collector re-read can
   *  take several seconds) approach the ceiling. Because the worker re-runs
   *  the read collector synchronously before signalling done, returning on
   *  done means the read cache is already fresh — so the existing DataTable
   *  reload shows the change immediately without optimistic UI. Past the
   *  ceiling we return "queued" with the jobId; the client then polls
   *  /api/jobs/:id until done (cache fresh) and reloads. Kept short so the
   *  HTTP response stays snappy and the client drives the rest. */
  WRITE_QUEUE_SYNC_WAIT_MS: z.coerce.number().int().nonnegative().default(3_000),
  /** TTL (seconds) of the job + status keys in the per-target Redis. */
  WRITE_QUEUE_JOB_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  /** TTL (seconds) of the sudo credential the panel registers for the worker
   *  (lpwq:v1:cred). Refreshed on every submit that needs sudo. */
  WRITE_QUEUE_CRED_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  /** A job still "queued" (never picked up) for longer than this many ms is
   *  treated as stuck → the worker is likely dead on that server → notify. */
  WRITE_QUEUE_STUCK_MS: z.coerce.number().int().positive().default(60_000),
  /** Backup scheduler fan-out to REMOTE targets. When true (default) the
   *  minute tick also runs each enabled vault target's due schedules against a
   *  scheduler-owned DirectSshExecutor (so scheduled backups land on the TARGET,
   *  not the panel host). Set false to roll back to the historical panel-host-
   *  only behaviour (local target only). See backup/services/scheduler.service. */
  BACKUP_SCHEDULER_REMOTE_TARGETS: boolStrTrue,
  /** Optional OVERRIDE for the write-behind HMAC signing key. Normally the
   *  panel reads each target's per-box key (provisioned 0640 by
   *  install-engines.sh) over SSH and signs every enqueued job with it, so the
   *  on-box worker (LPWQ_REQUIRE_HMAC) accepts it. Set this only to pin a
   *  single shared key across every target (skips the per-box read). Empty →
   *  read per-box; if neither is available the panel enqueues UNSIGNED and logs
   *  WARN_QUEUE_NO_HMAC (dev), which a fail-closed worker will reject. */
  WRITE_QUEUE_HMAC_KEY: z.string().default(""),

  // --- Module Dev (módulo "module-dev": ciclo de vida de módulos del marketplace) ---
  /** Tope (ms) del runner de tests del módulo en el servidor target. El valor
   *  por-request (`timeoutMs`) nunca puede superar el cap duro de 600s. */
  MODULE_DEV_TEST_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  /** Cap de stdout/stderr capturados por el runner de tests (KB). */
  MODULE_DEV_TEST_MAX_OUTPUT_KB: z.coerce.number().int().positive().default(256),
  /** Kill-switch del flujo de preview Modo B (VENDORIZADO del módulo del dev en
   *  disco). DEFAULT FALSE y debe seguir así: el runtime que EJECUTA el código
   *  del preview es OUT-OF-PROCESS y todavía NO está integrado
   *  (`shared/preview-sandbox/runtime.ts`, `isAvailable()===false`). Con este
   *  flag encendido un preview sólo se vendoriza en disco; su código NO se
   *  importa en el proceso del panel (community-loader lo salta SIEMPRE) ni se
   *  ejecuta vía dispatch (fail-closed). Ejecutar código de un dev adversario en
   *  proceso convertiría un 0-day de V8/sandbox en RCE a nivel de proceso = robo
   *  de secretos CROSS-TENANT (mTLS key, LUXIPANEL_KEY, executores SSH de otros
   *  tenants en el mismo heap). NO poner default true ni reintroducir un sandbox
   *  in-process: la frontera real es un proceso/contenedor separado sin secretos
   *  heredados. Tres revisiones hostiles: "safe-but-keep-disabled". */
  MODULE_DEV_PREVIEW_ENABLED: boolStr,
  /** Máximo de archivos vendorizados en una instalación preview (Modo B). */
  MODULE_DEV_PREVIEW_MAX_FILES: z.coerce.number().int().positive().default(200),
  /** Tamaño total máximo (MB) de una instalación preview (Modo B). */
  MODULE_DEV_PREVIEW_MAX_TOTAL_MB: z.coerce.number().int().positive().default(10),

  // --- Preview sandbox runtime (PIPS, Fase F1) — config de INSTANCIA ---
  // Flags de tuning del runtime out-of-process de preview. NO son secretos y
  // NO van a sidecars por-servidor: son estado de instancia del host del panel.
  // Default deshabilitado: con ENABLED=false el runtime queda inerte
  // (fail-closed) y estos valores no tienen efecto (ver preview-sandbox/config.ts).
  //
  // SEGURIDAD (kill-switch maestro): DEBE usar `boolStr`, NUNCA
  // `z.coerce.boolean()`. `z.coerce.boolean()` aplica `Boolean(string)`, así que
  // CUALQUIER string no vacío — incluido literalmente `"false"` — coacciona a
  // `true`. El gesto operativo natural de poner `PREVIEW_SANDBOX_ENABLED=false`
  // en `.env` para deshabilitar el runtime lo ARMARÍA. `boolStr` parsea
  // `"false"`/`"0"`/ausente → `false` (fail-closed), `"true"`/`"1"` → `true`.
  PREVIEW_SANDBOX_ENABLED: boolStr,
  PREVIEW_SANDBOX_MIN_TIER: z.coerce.number().int().default(1),
  PREVIEW_SANDBOX_POOL_SIZE: z.coerce.number().int().nonnegative().default(2),
  PREVIEW_SANDBOX_REUSE: z.enum(["once", "pooled"]).default("once"),
  PREVIEW_SANDBOX_DISPATCH_MS: z.coerce.number().int().positive().default(5000),
  PREVIEW_SANDBOX_MEM_MAX_MB: z.coerce.number().int().positive().default(256),
  PREVIEW_SANDBOX_CPU_QUOTA_PCT: z.coerce.number().int().positive().default(50),
  PREVIEW_SANDBOX_MAX_FRAME: z.coerce.number().int().positive().default(1048576),
  // §9: output cap pinned to 256 KiB (the wire contract / tmpfs sizing bound).
  PREVIEW_SANDBOX_MAX_OUTPUT: z.coerce.number().int().positive().default(262144),
  // §7.4: scrub rootfs tmpfs 64M, /scratch tmpfs 32M (design-pinned safe sizes).
  PREVIEW_SANDBOX_ROOT_MB: z.coerce.number().int().positive().default(64),
  PREVIEW_SANDBOX_SCRATCH_MB: z.coerce.number().int().positive().default(32),
  PREVIEW_SANDBOX_ABI: z.string().default(""),
  // §5/§7.4 caps the F1 env lacked: per-dispatch capCall ceiling, bounded FIFO
  // queue depth, per-owner token bucket, and pooled-mode dispatch reuse cap.
  PREVIEW_SANDBOX_MAX_CAPS_PER_DISPATCH: z.coerce.number().int().positive().default(64),
  PREVIEW_SANDBOX_QUEUE_MAX: z.coerce.number().int().nonnegative().default(16),
  PREVIEW_SANDBOX_PER_OWNER_RATE: z.string().default("6/30s"),
  PREVIEW_SANDBOX_WORKER_MAX_DISPATCHES: z.coerce.number().int().positive().default(20),

  // --- Headroom (reducción de tokens del asistente, modo API) ---
  // Motor = proxy Python local (headroom-ai) en el host del panel, escuchando
  // SOLO en loopback. Estado de INSTANCIA (no per-server): no usa Executor, es
  // una llamada HTTP a 127.0.0.1. La integración comprime los OUTPUTS de las
  // tools (salidas de comandos / JSON / logs) dentro del loop agéntico de cada
  // provider API, justo antes de mandarlos al modelo. SmartCrusher (estructural,
  // sin ML) reduce ~45% esas salidas; el resto (system/usuario) NO se toca, así
  // que el prompt-cache nativo de claude se preserva. TODO es FAIL-OPEN: si el
  // proxy está caído/lento, se manda el output original y el asistente sigue.
  //
  // SEGURIDAD: kill-switch con `boolStr` (NUNCA `z.coerce.boolean`, que
  // coacciona "false" → true y armaría el flag al intentar apagarlo).
  // Default ON: el gate de salud (ping cacheado 30s) mantiene el coste en cero
  // cuando el proxy no está instalado, y todo el camino es fail-open.
  HEADROOM_ENABLED: boolStrTrue,
  HEADROOM_BASE_URL: z.string().url().default("http://127.0.0.1:8787"),
  /** Bearer opcional del proxy; vacío = loopback sin auth (caso normal). */
  HEADROOM_API_KEY: z.string().default(""),
  /** Timeout duro (ms) de cada llamada al proxy; al vencer → fail-open. */
  HEADROOM_TIMEOUT_MS: z.coerce.number().int().positive().default(6_000),
  /** Sólo se comprime un output de tool si supera este nº de tokens estimados
   *  (chars/4). Debajo de esto, el ahorro no compensa la latencia → se omite. */
  HEADROOM_MIN_TOKENS: z.coerce.number().int().positive().default(400),

  // --- Assistant context window guard / compaction ---
  // A long chat (especially CLI, which resumes its own growing upstream
  // transcript) eventually overruns the model's context window: the CLI starts
  // auto-dropping older turns, so the user's recent requests "no se quedan".
  // The guard estimates the conversation's context size (chars/4 over stored
  // content + cliLog) and: (a) lets the UI show a "Compactar" button past WARN,
  // (b) auto-compacts before a run past AUTOCOMPACT. Compaction summarizes the
  // older turns into one note and resets the upstream CLI session.
  /** Usable context window (tokens) the guard measures against. Default 200k =
   *  Claude's standard window; raise to 1_000_000 for the 1M beta. */
  ASSISTANT_CONTEXT_WINDOW_TOKENS: z.coerce.number().int().positive().default(200_000),
  /** Fraction of the window at which the UI surfaces the manual compact button. */
  ASSISTANT_CONTEXT_WARN_RATIO: z.coerce.number().positive().max(1).default(0.75),
  /** Fraction at which a send auto-compacts FIRST (best-effort, never blocks). */
  ASSISTANT_CONTEXT_AUTOCOMPACT_RATIO: z.coerce.number().positive().max(1).default(0.9),
  /** CLI-specific auto-compact fraction (also drives the upstream `.jsonl`
   *  reset budget). Lower than the generic ratio because the chars/4 estimate
   *  under-counts the real transcript a CLI session replays on --resume. */
  ASSISTANT_CONTEXT_AUTOCOMPACT_RATIO_CLI: z.coerce.number().positive().max(1).default(0.8),
  /** Most-recent messages kept verbatim after a compaction (older → summary). */
  ASSISTANT_CONTEXT_COMPACT_KEEP: z.coerce.number().int().nonnegative().default(4),
  /** Master kill-switch: false → no guard, no auto-compaction, no compact API. */
  ASSISTANT_CONTEXT_GUARD_ENABLED: boolStrTrue,
  /** Adjunta el MCP del grafo de código (codebase-memory-mcp del target) a las
   *  corridas CLI de proyectos indexados + inyecta el bloque de prompt que
   *  ordena preferir el grafo sobre grep/lecturas completas. Kill-switch. */
  ASSISTANT_GRAPH_MCP_ENABLED: boolStrTrue,
  /** Máximo de corridas del agente VIVAS a la vez por usuario del panel (entre
   *  todas sus conversaciones). Turnos sobre una conversación con run vivo se
   *  encolan (no cuentan). 0 = sin límite. */
  ASSISTANT_MAX_CONCURRENT_RUNS_PER_USER: z.coerce.number().int().nonnegative().default(0),
  /** Credencial por-panel (`lxp_live_…`) para LP y el túnel del portal.
   *  Vacía (default) = funciones LP bloqueadas y túnel deshabilitado.
   *  Ver auth/middlewares/lp-panel-credential.middleware.ts. */
  LP_PANEL_CREDENTIAL: z.string().default(""),
  // --- Panel-to-panel MCP (Agentes IA reach another LUXIPANEL box's MCP) ---
  /** Master switch for the agent's panel-to-panel MCP transport. When false
   *  (default), the agent's servers.* tools ALWAYS use direct SSH — exact
   *  parity with today. When true, a target flagged `hasLuxipanel` with a
   *  provisioned peer token is operated via the target's own MCP endpoint
   *  (typed tools + its permission broker + its audit), falling back to direct
   *  SSH if the MCP endpoint is unreachable. See ai-assistant/servers-agent-
   *  capability.ts + panel-peer-mcp-client. */
  PANEL_PEER_MCP_ENABLED: boolStr,
  /** THIS box's inbound peer credential (`lxp_peer_…`) that OTHER LUXIPANEL
   *  panels present as bearer on `POST /api/ai/mcp/peer` to run this box's
   *  peer.* tools. Normally auto-provisioned over SSH by the pairing flow
   *  (hash stored in a 0600 sidecar); this env is a manual override / escape
   *  hatch (matched by hash, constant-time). Empty (default) + no stored hashes
   *  = inbound peer MCP rejects every bearer. Verified in
   *  ai-assistant/services/peer-credentials.service.ts; the endpoint auth lives
   *  in ai-assistant/controllers/mcp-peer.controller.ts. */
  PANEL_PEER_CREDENTIAL: z.string().default(""),
  /** TTL de la caché en memoria de `GET /api/ai/stats/cli-quota`. La lectura real
   *  hace un exec SSH en el target que a su vez curlea al proveedor (hasta 15 s);
   *  el frontend la sondea, así que sin caché cada sondeo cuelga la vista. Las
   *  cuotas son ventanas de ≈5 h / 7 días: un TTL corto no pierde precisión.
   *  0 = sin caché (siempre lectura viva). */
  ASSISTANT_CLI_QUOTA_TTL_MS: z.coerce.number().int().nonnegative().default(60_000),
  /** Cuánto tiempo se sigue sirviendo el ÚLTIMO valor bueno cuando la lectura
   *  falla (box sin login, endpoint caído, red). Preferimos un número de hace
   *  unos minutos a unas barras vacías; pasado este margen, se admite que no se
   *  sabe (null → el frontend cae a las barras de estimación local). */
  ASSISTANT_CLI_QUOTA_STALE_MS: z.coerce.number().int().positive().default(600_000),
  /** Length of the rolling session window (hours) the usage ledger measures the
   *  "session" bar against — mirrors the provider session quota reset (Claude
   *  ≈ 5h). */
  ASSISTANT_USAGE_SESSION_HOURS: z.coerce.number().int().positive().default(5),
  /** Display-only denominator for the session usage bar (NOT a real plan limit). */
  ASSISTANT_USAGE_BUDGET_SESSION: z.coerce.number().int().positive().default(1_000_000),
  /** Display-only denominator for the weekly usage bar (NOT a real plan limit). */
  ASSISTANT_USAGE_BUDGET_WEEKLY: z.coerce.number().int().positive().default(10_000_000),
  /** Canal MCP per-run (`/api/ai/mcp/cross`) por LOOPBACK cuando el agente corre
   *  en el mismo host que este backend.
   *
   *  El CLI del agente se lanza EN EL TARGET (`executor.exec`), así que la URL
   *  del canal debe ser alcanzable DESDE EL TARGET. Históricamente se le daba
   *  siempre el origen público (el Host del navegador), de modo que un agente
   *  corriendo en esta misma máquina salía a Internet → Cloudflare → nginx →
   *  y volvía a `127.0.0.1:8080`. Cada 521/502/timeout de ese rodeo tumbaba el
   *  canal MCP del run ENTERO (el cliente marca el server como failed y deja de
   *  listar sus tools). Con esto, si la sonda de co-localización confirma que el
   *  target ES este host, el canal va directo por loopback.
   *
   *  Kill-switch: a `false` se vuelve al 100% origen público sin tocar código. */
  ASSISTANT_MCP_LOOPBACK_ENABLED: boolStrTrue,
  /** Origen interno que se le entrega al agente co-localizado. Vacío → se deriva
   *  como `http://127.0.0.1:${PORT}`. Fíjalo solo si el backend no es alcanzable
   *  en el loopback por ese puerto. */
  ASSISTANT_MCP_LOOPBACK_ORIGIN: z.string().default(""),
  /** Max output tokens per Anthropic-compatible (claude/minimax) API turn ONLY.
   *  The Gemini and OpenAI providers do NOT read this — they use the model's
   *  default output cap. The old hardcoded 4096 silently truncated long answers
   *  on Claude 4.x (which supports far more); raise here without a code change. */
  ASSISTANT_API_MAX_TOKENS: z.coerce.number().int().positive().default(8192),
  /** Per-request timeout (ms) for the assistant HTTP/SSE API loop; a long
   *  completion is aborted after this so it can't pin a turn-queue slot forever. */
  ASSISTANT_API_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  /** Comma-separated allow-list of directory roots the file manager may access.
   *  Empty = fall back to "/host" (Docker) or "/" (bare metal). */
  FILE_MANAGER_BASES: z.string().default(""),
  /**
   * Live "steering" of an in-flight CLI turn: append the user's mid-run message
   * ("añadidura") to the SAME running process so the agent picks it up without
   * waiting for the turn to finish. Only claude/minimax (Claude Code binary,
   * `--input-format stream-json` over a stdin FIFO) honour it; everyone else
   * falls back to the continuation-on-settle path. OFF by default: it reworks
   * the CLI run lifecycle (process stays alive on a persistent stdin; turn-end
   * detected from the `result` event, not the exit file) and must be validated
   * on a real target server before enabling. When false, the CLI launch is
   * byte-identical to the legacy `</dev/null` one-shot. */
  ASSISTANT_LIVE_STEERING: boolStr,

  // --- Equipos v2 (aislamiento por worktree, verificación, presupuestos) ---
  /** Kill-switch del aislamiento: false → los workers corren sobre project.path
   *  como antes (sin worktree ni lease). */
  ASSISTANT_TEAM_ISOLATION_ENABLED: boolStrTrue,
  /** Máximo de runs de WORKER vivos a la vez por usuario (independiente del cap
   *  HTTP ASSISTANT_MAX_CONCURRENT_RUNS_PER_USER — los workers NO cuentan ahí).
   *  Al chocar, la tarea queda `pending` encolada y despacha al liberarse hueco.
   *  0 = sin límite. */
  ASSISTANT_MAX_WORKER_RUNS: z.coerce.number().int().nonnegative().default(0),
  /** Reintentos de corrección cuando la verificación de una tarea falla (cada
   *  reintento = turno automático en el chat del worker con el log). */
  ASSISTANT_TEAM_VERIFY_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  /** Timeout por COMANDO de la receta de verificación (executor.exec). */
  ASSISTANT_TEAM_VERIFY_CMD_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  /** Permite que team.assign traiga verifyCommands propios (vienen del MODELO
   *  líder y se ejecutan sin pasar por el broker → OFF por defecto). */
  ASSISTANT_TEAM_VERIFY_ALLOW_OVERRIDE: boolStr,
  /** Presupuesto de tokens por TAREA de equipo (0 = sin tope).
   *
   *  Granularidad real: el uso CLI se registra A GRANEL al cierre de cada
   *  turno, así que el enforcement (sweep + collect) puede llegar tarde — un
   *  overshoot de ~1 turno (60-80k) por worker es esperable. Al cierre de la
   *  tarea el exceso se ANOTA (`artifacts.tokens.overBudget` + nota en el
   *  resultSummary) sin reclasificar el status; el gasto cuenta al plan. */
  ASSISTANT_TEAM_TASK_TOKEN_BUDGET: z.coerce.number().int().nonnegative().default(400_000),
  /** Presupuesto de tokens por PLAN completo (suma de sus tareas; 0 = sin
   *  tope). Además del sweep, se comprueba ANTES de asignar cada tarea nueva
   *  (team.assign lanza "Presupuesto del plan agotado") y al DESPACHAR
   *  diferidas — misma granularidad a-granel que el budget por tarea. */
  ASSISTANT_TEAM_PLAN_TOKEN_BUDGET: z.coerce.number().int().nonnegative().default(1_500_000),
  /** Intervalo del sweeper de presupuestos sobre runs vivos (0 = off). */
  ASSISTANT_TEAM_BUDGET_CHECK_MS: z.coerce.number().int().nonnegative().default(60_000),
  /** Bytes del diff de preview persistido en artifacts de la tarea. */
  ASSISTANT_TEAM_DIFF_PREVIEW_BYTES: z.coerce.number().int().positive().default(30_000),
  /** Bytes máximos del diff completo servido por GET /team/tasks/:id/diff. */
  ASSISTANT_TEAM_DIFF_MAX_BYTES: z.coerce.number().int().positive().default(1_000_000),
  /** Habilita el modo PR de team.integrate (push + gh pr create). */
  ASSISTANT_TEAM_PR_ENABLED: boolStr,
  /** Kill-switch de las tools browser.* (Chromium headless en el target para
   *  verificación visual de agentes QA). */
  ASSISTANT_BROWSER_TOOLS_ENABLED: boolStrTrue,
  /** Timeout por carga de página de Chromium (check/screenshot). */
  ASSISTANT_BROWSER_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /** Directorio de screenshots en el target (se añade al jail de runs con jail). */
  ASSISTANT_BROWSER_SHOT_DIR: z.string().default("/tmp/lxp-browser"),

  // --- Piper (offline local TTS, the "CLI" audio engine; runs on the panel host) ---
  // Binary + runtime dir (holds libonnxruntime/libespeak-ng + espeak-ng-data) and
  // the voice models dir (`*.onnx` + `*.onnx.json`). Independent of any API quota.
  PIPER_BIN: z.string().default("/opt/piper/piper"),
  PIPER_DATA_DIR: z.string().default("/opt/piper"),
  PIPER_MODELS_DIR: z.string().default("/opt/piper/models"),

  // --- Standalone multi-node SSH targets (vault + host policy) ---
  // Master key for the LOCAL encrypted target vault (modules/servers). AES-256-GCM
  // at rest via HKDF-SHA256 (see modules/servers/services/servers-vault-crypto.ts).
  // 64 hex chars (32 bytes) or EMPTY. When empty: outside production the key is
  // derived from JWT_SECRET (dev convenience); in production the derivation still
  // works but the crypto layer emits ONE actionable warning at first use urging
  // an explicit CREDENTIAL_VAULT_KEY (so the vault key is decoupled from the JWT
  // secret and survives a JWT rotation). Validated shape: empty or 64-hex.
  CREDENTIAL_VAULT_KEY: z
    .string()
    .default("")
    .refine((v) => v === "" || /^[0-9a-fA-F]{64}$/.test(v), {
      message: "CREDENTIAL_VAULT_KEY must be 64 hex chars (32 bytes) or empty",
    }),
  // Relax the SSRF host policy for standalone boxes that legitimately manage
  // servers on their OWN LAN (RFC1918 / loopback / link-local). Default false =
  // the strict managed-gateway policy (block all private ranges after DNS
  // resolution). When true, RFC1918/loopback/link-local/CGNAT targets are
  // permitted, but cloud metadata (169.254.169.254) and multicast/reserved
  // ranges stay blocked. Only enable on a single-node LAN administrator box.
  SERVERS_ALLOW_PRIVATE: boolStr,

  // --- BitNinja ---
  /** Optional SHA-256 (64 hex) integrity pin for the remote BitNinja installer
   *  script. When set, the install aborts (fail-closed) if the downloaded
   *  install.sh doesn't match; absent → prior behavior (run with a WARN). */
  BITNINJA_INSTALLER_SHA256: z.string().optional(),

  // --- Tolqia (audio calls with real-time translation) ---
  // The calls engine runs as its OWN service (pm2 `tolqia`, 127.0.0.1:4500);
  // LUXIPANEL is only an integrator: it mints rooms/tokens over the S2S API and
  // receives signed webhooks. Every var has a sane default so a box WITHOUT
  // Tolqia still boots — `CALL_ENABLED` is the real gate (the call routes 404
  // when it is false, and the bridge refuses to start a call without a secret).
  /** Kill-switch for the whole calls feature (routes + UI affordances). */
  CALL_ENABLED: boolStrTrue,
  /** Base URL of the Tolqia server (loopback behind nginx). */
  TOLQIA_URL: z.string().default("http://127.0.0.1:4500"),
  /** S2S bearer — must equal Tolqia's own `TOLQIA_SERVICE_SECRET`. */
  TOLQIA_SERVICE_SECRET: z.string().default(""),
  /** HMAC secret for inbound webhooks — equals Tolqia's `WEBHOOK_SECRET`. */
  TOLQIA_WEBHOOK_SECRET: z.string().default(""),
  /**
   * Public path Tolqia is mounted at behind nginx. Informational only: the
   * browser MUST open the `wsUrl` returned by `POST /v1/calls/tokens`, which
   * already carries this prefix. Kept so the UI can explain the mount.
   */
  TOLQIA_PUBLIC_PATH: z.string().default("/tolqia"),
  /** Mirror of Tolqia's `RING_TIMEOUT_MS`; drives the local ring UI timeout. */
  CALL_RING_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),

  // --- i18n ---
  DEFAULT_LOCALE: z.enum(["es", "en", "fr", "de", "it", "pt", "ar", "bn", "hi", "ja", "ko", "ru"]).default("es"),
  SUPPORTED_LOCALES: commaSep.default("es,en,fr,de,it,pt,ar,bn,hi,ja,ko,ru"),
})
  // In production CREDENTIAL_VAULT_KEY is MANDATORY: an empty value silently
  // derives the vault key from JWT_SECRET, so a JWT rotation (or a JWT_SECRET
  // compromise) would drop/expose the whole `servers/targets.json` vault. Fail
  // the boot instead of degrading silently. Outside production the empty →
  // JWT-derived convenience still applies (dev/test).
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === "production" && val.CREDENTIAL_VAULT_KEY === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CREDENTIAL_VAULT_KEY"],
        message:
          "CREDENTIAL_VAULT_KEY is mandatory in production (64 hex chars / 32 bytes). " +
          "An empty value would derive the target-vault key from JWT_SECRET and break on JWT rotation.",
      });
    }
    // ENCRYPTION_KEY is the MCP secret-vault master key. Optional in dev/test so
    // a box that never touches MCP secrets still boots, but MANDATORY in
    // production: the schema's .min(32) enforces the length whenever present, so
    // here we only need to reject its absence.
    if (val.NODE_ENV === "production" && !val.ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ENCRYPTION_KEY"],
        message:
          "ENCRYPTION_KEY is mandatory in production (min 32 chars): it is the MCP secret-vault master key.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ✗ ${i.path.join(".")}: ${i.message}`)
      .join("\n");

    console.error("╔══════════════════════════════════════════╗");
    console.error("║  LUXIPANEL — Environment Validation Error  ║");
    console.error("╚══════════════════════════════════════════╝");
    console.error(formatted);
    console.error("\nFix the issues above and restart the server.");
    process.exit(1);
  }

  return result.data;
}

/** Validated environment — safe to use everywhere. */
export const env = validateEnv();

/** Loopback port of the per-target client-cache Redis (default 7379). Single
 *  source of truth for the cache-stack port used across modules. */
export const CACHE_REDIS_PORT = parseInt(env.LUXIPANEL_CACHE_PORT ?? "7379", 10);
