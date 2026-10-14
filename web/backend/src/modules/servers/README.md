# Servers Module

Local, encrypted registry of the SSH **targets** this standalone panel may
reach. In standalone multi-node mode a single LUXIPANEL box administers several
remote servers by direct SSH (`DirectSshExecutor`) plus its own host
(`localExecutor`). This module owns the vault of "which servers, with what
credentials" and the trust-on-first-use (TOFU) host-key flow that gates every
connection.

It is **control-plane state of the panel host**, not per-managed-server data:
the repository is pinned to `localExecutor` and the sidecar lives on the box the
panel runs on — `${LUXIPANEL_CONFIG_DIR}/servers/targets.json` (`0600`,
enforced by the kv-store invariant). Nothing here talks to LP-LICENSE-SERVER.

## The SINGLE SSH vault (consolidated)

This is the **one** SSH target registry in LUXIPANEL. Three consumers share it:
1. the **sidebar server selector** (`/switch` → bridge → `X-Bridge-Session-Id`),
2. the **AI agent's `servers.*` tools** (cross-server exec/read/list — resolved
   here via `targetsRepository.getMaterial`, host-key pinning included), and
3. the **Ajustes → Servidores** tab UI (frontend CRUD).

The assistant's former separate "Servers" registry (`assistant/registered-
servers.json`) was retired and its UI moved into Ajustes; the agent now resolves
targets from this vault (see `ai-assistant/servers-agent-capability.ts`, which
imports `targetsRepository` + `userMayUseTarget` from `modules/servers/index.ts`
— the ONLY cross-module entry point).

## Ownership model (global + per-user private)

Any authenticated control-plane user may use this API (routes are `requireAuth`,
no longer `requireModule("admin")`); per-record authorization lives in the
service:
- **`userMayUseTarget(target, viewer)`** — the single rule shared by list
  filtering, the switch, and the agent tools. Admin → anything; a `private`
  target → only its `ownerId`; a `global` target → any user, honoring
  `allowedUserIds` (empty = everyone).
- **`assertMayManage`** — mutations (update/delete/test/approve): admin → any;
  non-admin → only their own private targets.
- **`visibility`** (`global` | `private`, absent ⇒ `global` for legacy records):
  admins create `global` targets (`ownerId=null`); a non-admin creates a
  `private` target owned by themselves. Only admins may set `allowedUserIds`.

Pinned by `services/servers.authz.test.ts` (the full visibility matrix).

## Endpoints

`requireAuth` (per-record authorization in the service); mutations are
CSRF-protected.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/servers` | List targets the caller may see — **never** returns secret material (presence flags only). |
| POST | `/api/servers` | Register a target (private for non-admins, global for admins). Runs the SSRF host policy (`assertSafeTargetHost`). |
| PUT | `/api/servers/:id` | Update (own/global-by-admin). Changing `host` invalidates the pinned fingerprint (TOFU re-run). |
| DELETE | `/api/servers/:id` | Remove a target (own/global-by-admin). |
| POST | `/api/servers/:id/test` | First-contact / connectivity probe. Captures the host key. |
| POST | `/api/servers/:id/fingerprint/approve` | Promote the pending fingerprint → pinned. |
| POST | `/api/servers/:id/switch` | Open a direct bridge to the target; mints `X-Bridge-Session-Id` (still returned in the body — the client seeds it as the per-tab override). **Also re-signs the session cookie** with `{bridgeSessionId, targetId, targetName, direct:true}` so a request that arrives WITHOUT the per-tab header still resolves to THIS target instead of silently falling through to LOCAL (cross-server isolation leak). Disposes the previous bridge(s) — the per-tab header target AND the cookie's own bridge, deduped — so a remote→remote switch doesn't abandon the prior SSH connection. Revokes the previous JWT (`jti` denylist, best-effort). Rejected (`Validation`) for `kind:"hosting"` sessions (bound to their tenant target by design). |
| POST | `/api/servers/local/switch` | **Explicit return to the CONNECTED (local) server.** Disposes the per-tab override bridge (`X-Bridge-Session-Id`) AND the cookie's own bridge, then re-signs the session cookie **without any target/bridge claim** (`local:true`) so the JWT no longer pins a remote target (a client-side header clear can't escape a JWT-pinned session — the cookie is httpOnly), and revokes the previous JWT (best-effort). Responds `{ ok, data: { local, targetId:"local", targetName:"Local", bridgeSessionId:"", clearBridge:true } }`; on `clearBridge` the client drops its stored per-tab id and reloads → middleware resolves the local executor. Explicit user action only — never an automatic fallback (a live DIRECT remote session stays fail-closed). Rejected (`Validation`) for `kind:"hosting"` sessions. **Registered with `requireAuthNoExecutor` (before the `requireAuth` gate)** so it stays reachable when the pinned bridge's SSH material EXPIRED: `requireAuth` would resolve the executor and `getExecutorAsync` throws fail-closed on dead material → 500, trapping the user on the dead bridge. This route never touches the target, so it needs no ambient executor. |

## Panel-to-panel MCP (optional, flag-gated) — see ai-assistant

A target that also runs LUXIPANEL can be flagged `hasLuxipanel` + `luxipanelBaseUrl`.
When `PANEL_PEER_MCP_ENABLED=true` and a peer credential has been paired (over
SSH), the AI agent reaches it via the target's own MCP endpoint
(`/api/ai/mcp/peer`, typed `peer.*` tools + the target's audit) instead of raw
SSH, falling back to SSH on any transport error. The peer credential is stored
here encrypted (`peerCredentialEnc`, never exposed in a view); pairing lives in
`ai-assistant/services/panel-pairing.service.ts` (endpoint `POST
/api/ai/servers/:id/pair`). The transport is **off by default** — parity with
direct SSH until explicitly enabled.

## The credential vault (at rest)

Secret fields (`secretEnc` = private-key PEM or password; `passphraseEnc`) are
encrypted with **AES-256-GCM**, the key derived via **HKDF-SHA256**
(`services/servers-vault-crypto.ts`). Envelope: `v2:<ivHex>:<tagHex>:<ctHex>`
(12-byte IV, 16-byte GCM tag). The `v2:` prefix reserves room for re-keying
without a data migration.

Input keying material (IKM), in precedence:
1. `CREDENTIAL_VAULT_KEY` (64 hex / 32 bytes) — the canonical, JWT-independent
   vault key. **Required in production.** If it changes, the vault stops
   decrypting (`getMaterial` throws — never connects with wrong creds).
2. Otherwise a SHA-256 of the panel JWT secret (dev / back-compat). In
   production this still works but logs **one** actionable warning urging an
   explicit key. Note: this is a *warn-and-derive* fallback, not a hard refuse.

Guarantees pinned by tests (`servers-vault-crypto.test.ts`):
- Round-trips non-empty plaintext; fresh random IV per call.
- `decryptSecret` **throws** on a tampered ciphertext or auth tag (GCM
  integrity), a missing `v2:` prefix, or a malformed envelope — never silent.
- **Edge case:** an empty-string secret does not round-trip (empty ciphertext →
  malformed 4th component → throws). Not reachable in prod: `secret` is Zod
  `min(1)` and a passphrase is encrypted only when truthy.

**Coupling note (vault-crypto ↔ auth):** `servers-vault-crypto` imports
`authConfig.jwt.secret` solely for the dev IKM fallback. Setting
`CREDENTIAL_VAULT_KEY` decouples the vault from JWT rotation; the import stays
only to keep dev/back-compat working.

`listView()`/`toView()` NEVER carry secret bytes — only `hasPassphrase` and
status flags. Decrypted material is exposed solely via `getMaterial()` for the
executor / the switch bridge.

## Host-key trust model (TOFU with persistence — fail-closed)

The module implements **trust-on-first-use with persistence and explicit
approval**, not blind acceptance:

1. **First contact** — `POST /:id/test` opens an ssh2 connection *only to
   observe the presented host key* (`probeHostKey`). With no pin yet it captures
   the key into `hostFingerprintPending` and returns `pending` (HTTP 409
   `HOST_FINGERPRINT_PENDING_APPROVAL`). It does **not** trust it yet.
2. **Approval** — `POST /:id/fingerprint/approve` promotes pending → pinned
   (`hostFingerprint`). A human admin makes the trust decision.
3. **Key change** — a later `test` whose captured key differs from the pin is a
   security event: the new key is stored as pending (`changed:true`) and
   re-approval is required; traffic is refused until then.
4. **Every real connection is pinned & fail-closed** — `getMaterial()` puts the
   pinned fingerprint into `expectedHostFingerprint`, and
   `DirectSshExecutor.connect()` installs a `hostVerifier` that aborts the
   handshake on mismatch (verify → `false`). `POST /:id/switch` **refuses** to
   hand out material until a fingerprint is approved.

**Decision — the default was NOT flipped.** ssh2's default (no `hostVerifier`)
accepts any key, and `DirectSshExecutor` only installs the verifier when the
material carries an expected fingerprint. That absent-verifier path is the
legacy managed flow, which is retired; in the standalone target-vault flow the
`switch` gate makes an approved pin mandatory, so a real bridge is always
pinned. Forcing pinning globally at the ssh2 layer would risk breaking any
residual unpinned caller with no security gain here, so the safe fix was to keep
the gate at the vault/switch boundary (already present) rather than change the
executor default. The one connection that is deliberately *not* pinned is the
transient password-auth probe inside `verifyAccountPassword` (see below), which
authenticates to an already-known host purely to check a password.

## `verifyAccountPassword` — FAIL-CLOSED (security-critical)

`DirectSshExecutor.verifyAccountPassword(username, password)` validates a Linux
account password before minting a login keypair (its only caller is
`users.controller.generateLoginKey`, gated on `executor instanceof
DirectSshExecutor`). **It is not on the panel login path** (that is
`loginLocal`/PAM), but a false positive would encrypt a login key with an
unproven passphrase.

Branches (pinned by
`shared/executor/direct-ssh-executor.verify-account-password.test.ts`):
- Invalid username grammar or empty password → `false` (no connection).
- Password-auth SSH connects (`ready`) → `true`.
- Non-auth connection error → `false`.
- Server denies password auth → fall back to `su <user> -c 'exit 0'` over a PTY
  on the admin connection: exit 0 → `true`, non-zero → `false`.
- **FAIL-CLOSED:** when `su` cannot be exec'd, or the admin connection cannot be
  opened, → `false`. ("Could not verify" is not "verified.") This was previously
  **fail-open** (returned `true`), an auth-bypass on the key-mint path; now
  fixed with regression tests.

## AI agent capability — intentionally ABSENT

This module has **no `agent-capability.ts`**, by design. The target vault is a
privileged control-plane surface: registering a target writes **SSH credentials
into the encrypted vault**, is SSRF-sensitive, and includes host-key trust
decisions. Its REST routes require `requireModule("admin")`. Exposing target
CRUD / host-key approval to the AI assistant would let an agent add arbitrary
SSH destinations or approve unverified host keys — outside the assistant's
per-target operational scope and a credential-exfiltration risk. Server
registration stays a human-admin action. Revisit only if a tightly-scoped,
read-only listing tool is ever justified.

## Files

- `models/index.ts` — `TargetRecord` (persisted, ciphertext secrets),
  `TargetView` (UI-safe), Zod create/update schemas.
- `services/servers-vault-crypto.ts` — AES-256-GCM + HKDF encrypt/decrypt.
- `services/servers.service.ts` — CRUD + `probeHostKey` + TOFU test/approve.
- `repositories/targets.repository.ts` — sidecar CRUD (pinned to
  `localExecutor`), `getMaterial()` decrypt-for-executor.
- `controllers/servers.controller.ts` — CRUD + test/approve HTTP surface.
- `controllers/target-switch.controller.ts` — `switch` bridge (fills
  `sshCredentialsCache`, requires an approved fingerprint) + `switchToLocal`;
  both delegate cookie re-signing to the service below.
- `services/target-switch.service.ts` — `resignSessionWithBridge(req, res, claims)`
  (claims = pin to a direct target; `null` = strip to LOCAL), `bridgeTtlSeconds`,
  and the `BRIDGE_CLAIMS`/`RESERVED_JWT_CLAIMS` strip lists. Shared by both switch
  paths so they re-sign / revoke identically.
- `routes/servers.routes.ts`, `index.ts` — wiring (the `/local/switch` escape
  hatch uses `requireAuthNoExecutor`, registered before the `requireAuth` gate).
