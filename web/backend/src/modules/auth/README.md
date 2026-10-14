# Auth Module

Handles all authentication flows, session management, and security features.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/login` | Public | Username + password login |
| GET | `/api/session` | Required | Get current session info |
| POST | `/api/logout` | Required + CSRF | Clear session cookie |
| GET | `/api/auth/passkeys` | Required | List registered passkeys |
| POST | `/api/auth/passkeys/register-options` | Required | WebAuthn registration challenge |
| POST | `/api/auth/passkeys/register-verify` | Required + CSRF | Save new passkey |
| DELETE | `/api/auth/passkeys/:id` | Required + CSRF | Revoke passkey |
| POST | `/api/auth/passkeys/auth-options` | Public | WebAuthn auth challenge |
| POST | `/api/auth/passkeys/auth-verify` | Public | Verify passkey auth |
| POST | `/api/auth/otp/request` | Public | Send OTP via WhatsApp |
| POST | `/api/auth/otp/verify` | Public + CSRF | Verify OTP, get session |
| GET | `/api/auth/recovery/status` | Required | Recovery codes status |
| POST | `/api/auth/recovery/generate` | Required + CSRF | Generate new recovery codes |
| POST | `/api/auth/recovery/verify` | Public + CSRF | Verify recovery code |
| POST | `/api/auth/qr/request` | Public | Request QR auth token |
| POST | `/api/auth/qr/approve` | Required + CSRF | Approve pending QR request |
| GET | `/api/auth/qr/poll/:requestId` | Public | Poll QR approval status |

## Auth Flows

### Password login
```
POST /api/login → { user, pass, remember? } → sets luxipanel_session cookie
```

### WebAuthn Passkey
```
1. GET /api/auth/passkeys/auth-options → challenge (from browser)
2. POST /api/auth/passkeys/auth-verify → { credential } → sets session cookie
```

### OTP (WhatsApp)
```
1. POST /api/auth/otp/request → { username } → OTP sent to registered number
2. POST /api/auth/otp/verify → { username, code } → sets session cookie
```

### QR Auth (mobile approves desktop login)
```
Desktop:
  1. POST /api/auth/qr/request → { requestId, qrData }
  2. Poll GET /api/auth/qr/poll/:requestId until status = "approved"
  3. Receive token when approved

Mobile (authenticated):
  1. POST /api/auth/qr/approve → { requestId }
```

### SSO handoff (entrada YA AUTENTICADA desde el portal LP-LS)
Permite que "Conectar" en el portal LP-LS (o el pre-warm de un módulo en la app)
aterrice en el dashboard del box YA autenticado, sin segundo login y sin webview.
LP-LS reutiliza las credenciales Linux (usuario + passphrase) que guarda cifradas
al registrar el servidor; NO actúa de puente de tráfico.
```
1. LP-LS (server-side) POST /api/auth/sso/exchange
     → { user, pass, remember? }
     → { ok:true, ticket }              (ticket de un solo uso, ≤60s en Redis)
     → { ok:true, mfaRequired:true }    (cuenta con 2FA → LP-LS cae al /login del box)
2. El NAVEGADOR (navegación top-level) GET /api/auth/sso/handoff?ticket=…[&next=/panel/…]
     → canjea el ticket (GETDEL: un solo uso), setea luxipanel_session same-origin,
       responde 200 + redirect client-side a `next` (si es una ruta /panel segura) o /panel.
```
Notas:
- `exchange` NO lleva CSRF (es servicio→servicio, sin cookie) ni `loginRateLimiter`
  por-IP (llega todo desde la única IP de LP-LS); el brute-force de una cuenta lo
  frena el lockout POR-CUENTA de `loginLocal` (`maxFailedLoginAttempts`).
- `handoff` responde **200 + Set-Cookie + refresh**, NO 302: el proxy Astro de
  `/api/*` sigue los redirects con su `fetch`, así que un 302 se perdería server-side.
- `next` se valida (`isSafeInternalPath`): sólo `/login` o rutas `/panel[/…]`
  same-origin → sin open-redirects.
- Núcleo compartido con el login normal: `authService.issueSession(user, remember)`
  (sin `res` → devuelve el token para acuñar el ticket, en vez de setear cookie).

## Session Format

JWT payload (stored in `luxipanel_session` httpOnly cookie):
```json
{
  "userId": 1,
  "username": "admin",
  "displayName": "Administrator",
  "role": "admin",
  "modules": ["admin", "mail", "users"],
  "kind": "admin"
}
```

`kind` is `"admin"` when modules includes `"admin"`, otherwise `"user"`.

## CSRF

All state-mutating requests (POST/PUT/PATCH/DELETE) require:
1. `luxipanel_csrf` cookie (set automatically by `csrfCookieSetter` middleware)
2. `X-CSRF-Token` header matching the cookie value

Double-submit cookie pattern — no server-side CSRF token storage needed.

## Middleware

- **`requireAuth`** — checks JWT from cookie or `Authorization: Bearer` header
- **`optionalAuth`** — populates `res.locals.user` if valid token present, does not reject
- **`requireModule(slug)`** — checks `res.locals.user.modules` includes `slug`
- **`csrfProtection`** — validates double-submit cookie on non-GET methods
- **`loginRateLimiter`** — Redis-backed per-IP rate limit (5 req/15min)

## Key Services

| Service | Purpose |
|---------|---------|
| `auth.service.ts` | **Facade** — re-exports the SAME surface (`authService` + the standalone lockout/bridge helpers + `invalidateRolesCache`). Implementation split under `services/auth/`: `auth-shared.ts` (private helpers), `auth-roles-cache.ts` (role memoization + `invalidateRolesCache`), `auth-lockout.service.ts` (failed-login counter, `recordFailedMfaAttempt`, `resolveLockScope`, `establishLocalBridge`), `auth-audit.service.ts` (`logAudit`), `auth-token.service.ts` (`computeModules` / `buildTokenPayload`), `auth-bootstrap.service.ts` (admin bootstrap + bridged identity), `auth-session.service.ts` (`buildLoginResponse` / `issueSession`), `auth-login.service.ts` (`login` / `loginLocal` / `loginHosting`). Pure code movement, no behaviour change. |
| `token.service.ts` | JWT sign/verify, cookie set/clear |
| `passkey.service.ts` | WebAuthn registration + authentication |
| `otp.service.ts` | OTP generation, WhatsApp delivery (placeholder), verification |
| `hcaptcha.service.ts` | hCaptcha token verification (skipped when `HCAPTCHA_ENABLED=false`) |
| `qr-auth.service.ts` | Redis-backed QR auth state machine |

## Config

| Env var | Default | Description |
|---------|---------|-------------|
| `JWT_SECRET` | — | **Required.** Min 32 chars |
| `JWT_EXPIRES_IN` | `24h` | Session token TTL |
| `JWT_REMEMBER_EXPIRES_IN` | `30d` | Remember-me TTL |
| `COOKIE_SECURE` | `false` | Set `Secure` flag on cookies |
| `COOKIE_SAMESITE` | `lax` | SameSite cookie attribute |
| `HCAPTCHA_ENABLED` | `false` | Enable hCaptcha on login |
| `WEBAUTHN_RP_ID` | `localhost` | Relying Party ID for WebAuthn |
| `WEBAUTHN_ORIGIN` | `http://localhost:4321` | WebAuthn expected origin |
