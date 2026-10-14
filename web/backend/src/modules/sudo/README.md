# Sudo Module

Manages the **per-target stored sudo password** that other modules reuse for
privileged operations (package install, `freshclam`, `systemctl` toggles, mail
quota, etc.) so the user does not retype it for every privileged action.

This module is **thin**: it exposes three endpoints that wrap the shared sudo
credential helpers in `shared/system/`. All business logic (encryption,
storage location, validation probe) lives in `shared/system`, not here.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sudo/status` | Auth | `{ ok, data: { stored } }` — whether a credential is stored for the connected target. Does **not** validate it. |
| POST | `/api/sudo/credential` | Admin + CSRF | Validate the password with a live `sudo … true` probe and store it **only on success**. Returns `{ ok, data: { stored: true } }`. |
| DELETE | `/api/sudo/credential` | Admin + CSRF | Remove the stored credential. Returns `{ ok: true }`. |

Setting/clearing the credential is gated behind `requireModule("admin")` (it
controls the password used for **every** `sudo` on the connected server) plus
CSRF. Reading `status` only needs an authenticated session.

Request body for `POST`: `{ "password": string }` (1–512 chars, Zod-validated).

## Credential model (where the secret lives, who can read it)

Implemented in `shared/system/sudo-credentials.ts` — this module only calls it.

- **Scope: per target server, never the panel host, never the browser.** The
  panel remembers **one** sudo password per connected target.
- **At rest: AES-256-GCM.** The key is derived (`SHA-256`) from the panel's
  `JWT_SECRET` + a fixed label. Nonce + ciphertext + auth tag are stored as a
  base64 JSON sidecar.
- **Storage path (chicken-and-egg):** the sidecar lives under the SSH user's
  **HOME** (`$HOME/.luxipanel/sudo-credentials.json`, mode `0600`), *not*
  `/etc/luxipanel` — the latter is not writable without root, but root is
  exactly what this credential bootstraps. Writing there would silently no-op
  (a non-zero `exec` exit does not throw) and the UI would re-prompt forever.
  Every write is verified by reading the ciphertext back; a real persistence
  failure throws.
- **Trust boundary:** anyone with `JWT_SECRET` **plus** filesystem access to
  that user's home can decrypt — the same boundary as the JWT session cookie.
  The plaintext is **never logged and never returned to the client** (`status`
  and `set` only ever return `{ stored }`).

## Validation on `set`

`sudoController.set` runs a no-op privileged probe via `sudoShell(executor,
sudo => \`${sudo} true\`, { sudoPassword })`. `sudoShell` pipes the password to
`sudo -S`, runs `true`, and **masks the secret out of any returned output**
(`.replace(password, "***")`), so a probe failure surfaced to the client as a
`ValidationError` can never leak the password. An invalid password maps to
`ValidationError("Contraseña sudo inválida.")` (code `SUDO_PASSWORD_INVALID`);
any other failure surfaces the masked probe output. On success the password is
persisted and `invalidateSudoPasswordCache(target.id)` is called so subsequent
actions pick it up. There is **no `res.status(500).json`** anywhere — errors are
typed and flow through `asyncHandler` to the error middleware.

## Agent capability

**N/A.** This module has no `agent-capability.ts` and intentionally exposes no
AI-agent tools: storing/clearing the root-equivalent sudo password is a
privileged, human-gated (`admin` + CSRF) action, not something an assistant
should perform on the user's behalf. Other modules consume the *stored*
credential transparently through `shared/system` — they never call this module.

## Files

```
sudo/
├── index.ts                       registerSudoModule(app) → mounts the router
├── controllers/sudo.controller.ts status / set / clear (thin)
└── routes/sudo.routes.ts          requireAuth + admin + CSRF gating
```

Shared dependencies (not owned here):
`shared/system/sudo-credentials.ts` (storage + crypto),
`shared/system/installer.ts` (`sudoShell` probe),
`shared/system/sudo-runtime.ts` (`invalidateSudoPasswordCache`).
