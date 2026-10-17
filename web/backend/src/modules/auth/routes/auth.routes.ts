// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth routes — defines all authentication endpoints.
 */

import { Router, type Router as ExpressRouter } from "express";
import { nativeAuthController } from "../controllers/native-auth.controller.js";
import { loginController } from "../controllers/login.controller.js";
import { ssoHandoffController } from "../controllers/sso-handoff.controller.js";
import { sessionController } from "../controllers/session.controller.js";
import { meController } from "../controllers/me.controller.js";
import {passkeyEnrollmentController} from "../controllers/passkey-enrollment.controller.js";
import { passkeyController } from "../controllers/passkey.controller.js";
import { otpController } from "../controllers/otp.controller.js";
import { recoveryController } from "../controllers/recovery.controller.js";
import { qrController } from "../controllers/qr.controller.js";
import { totpController } from "../controllers/totp.controller.js";
import { requireAuth, requireAuthNoExecutor, requireMfaPending } from "../middlewares/session.middleware.js";
import { csrfCookieSetter, csrfProtection } from "../middlewares/csrf.middleware.js";
import { loginRateLimiter, ssoExchangeRateLimiter } from "../middlewares/rate-limiter.middleware.js";

import { githubController } from "../controllers/github.controller.js";

const router: ExpressRouter = Router();

// ---- CSRF cookie (set on every request) ----
router.use(csrfCookieSetter);

// Each authenticated identity can connect its own GitHub account without admin privileges.
router.post("/api/auth/github/contributions/retry", requireAuthNoExecutor, csrfProtection, githubController.retry);
router.get("/api/auth/github/contributions/:id/recovery", requireAuthNoExecutor, githubController.recoveryPreview);
router.post("/api/auth/github/contributions/recover", requireAuthNoExecutor, csrfProtection, githubController.recover);
router.get("/api/auth/github/contributions", requireAuthNoExecutor, githubController.contributions);
router.get("/api/auth/github", requireAuthNoExecutor, githubController.status);
router.post("/api/auth/github", requireAuthNoExecutor, csrfProtection, loginRateLimiter, githubController.connect);
router.delete("/api/auth/github", requireAuthNoExecutor, csrfProtection, githubController.disconnect);
router.post("/api/auth/github/device", requireAuthNoExecutor, csrfProtection, loginRateLimiter, githubController.start);
router.post("/api/auth/github/device/poll", requireAuthNoExecutor, csrfProtection, githubController.poll);

// ---- Session ----
router.post("/api/login", loginRateLimiter, csrfProtection, loginController.login);
router.get("/api/session", requireAuth, sessionController.getSession);
router.get("/api/auth/ws-token", requireAuth, sessionController.getWebsocketToken);
router.post("/api/auth/refresh", requireAuth, sessionController.refresh);
router.get("/api/auth/bootstrap-status", requireAuth, sessionController.bootstrapStatus);
// Logout is idempotent (clearing your own cookie). CSRF blocks the
// bounce-back when the CSRF cookie was never set yet.
router.post("/api/logout", requireAuthNoExecutor, sessionController.logout);
router.get("/api/auth/login-methods", loginController.getLoginMethods);

// Native system-browser authentication; fixed callback and PKCE, full factors enforced.
router.get("/api/auth/native/capabilities", nativeAuthController.capabilities);
router.post("/api/auth/native/start", loginRateLimiter, nativeAuthController.start);
router.post("/api/auth/native/authorize", requireAuth, csrfProtection, nativeAuthController.authorize);
router.post("/api/auth/native/redeem", loginRateLimiter, nativeAuthController.redeem);

// ---- SSO handoff (entrada YA AUTENTICADA desde el portal LP-LS) ----
// `exchange` lo llama LP-LS server-side con las credenciales Linux del panel
// (guardadas cifradas allí) → devuelve un ticket de un solo uso. `handoff` lo
// abre el navegador (top-level) → setea cookie same-origin y entra a /panel.
// Sin CSRF: exchange es servicio→servicio (sin cookie). `ssoExchangeRateLimiter`
// keyea por USUARIO (no por la IP única de LP-LS) → defensa por-cuenta aunque el
// admin del box haya desactivado el lockout. handoff canjea un ticket opaco de
// ≤60s (un solo uso) y acepta GET (?ticket=) y POST (ticket en el body, para
// mantenerlo fuera de la URL / logs).
router.post("/api/auth/sso/exchange", ssoExchangeRateLimiter, ssoHandoffController.exchange);
router.get("/api/auth/sso/handoff", ssoHandoffController.handoff);
router.post("/api/auth/sso/handoff", ssoHandoffController.handoff);

// Módulos permitidos del usuario autenticado (lo consume LP por el túnel para
// decidir si muestra "Empezar conversación" / "Nueva terminal"). Auth simple
// (sin requireModule: debe responder aunque el usuario NO tenga esos módulos).
router.get("/api/me/modules", requireAuth, meController.getModules);

// ---- Passkeys (WebAuthn) ----
// List + manage passkeys (authenticated)
router.get("/api/auth/passkeys", requireAuth, passkeyController.list);
router.post("/api/auth/passkeys/register-options", requireAuth, passkeyController.registerOptions);
router.post("/api/auth/passkeys/register-verify", requireAuth, csrfProtection, passkeyController.registerVerify);
router.patch("/api/auth/passkeys/:id", requireAuth, csrfProtection, passkeyController.rename);
router.delete("/api/auth/passkeys/:id", requireAuth, csrfProtection, passkeyController.revoke);
// Native clients receive a restricted registration grant, never a panel session URL.
router.post("/api/auth/passkeys/enrollment", requireAuth, csrfProtection, passkeyEnrollmentController.issue);
router.get("/api/auth/passkeys/enrollment/:id", requireAuth, passkeyEnrollmentController.result);
router.post("/api/auth/passkeys/enrollment-options", loginRateLimiter, passkeyEnrollmentController.options);
router.post("/api/auth/passkeys/enrollment-verify", loginRateLimiter, passkeyEnrollmentController.verify);
// Passkey login (public) — rate-limited to throttle credential-stuffing.
router.post("/api/auth/passkeys/auth-options", loginRateLimiter, passkeyController.authOptions);
router.post("/api/auth/passkeys/auth-verify", loginRateLimiter, passkeyController.authVerify);

// ---- OTP (WhatsApp / preview) ----
router.post("/api/auth/otp/request", loginRateLimiter, otpController.request);
router.post("/api/auth/otp/verify", loginRateLimiter, csrfProtection, otpController.verify);

// ---- Recovery codes ----
router.get("/api/auth/recovery/status", requireAuth, recoveryController.status);
router.post("/api/auth/recovery/generate", requireAuth, csrfProtection, recoveryController.generate);
router.post("/api/auth/recovery/verify", loginRateLimiter, csrfProtection, recoveryController.verify);

// ---- QR Auth (desktop ↔ mobile handoff) ----
// request + poll are public and brute-forceable → rate-limit them.
router.post("/api/auth/qr/request", loginRateLimiter, qrController.request);
router.post("/api/auth/qr/approve", requireAuth, csrfProtection, qrController.approve);
router.get("/api/auth/qr/poll/:requestId", loginRateLimiter, qrController.poll);

// ---- TOTP 2FA management ----
router.get("/api/auth/totp/status", requireAuth, totpController.status);
router.get("/api/auth/totp/setup", requireAuth, totpController.setup);
router.post("/api/auth/totp/enable", requireAuth, csrfProtection, totpController.enable);
router.patch("/api/auth/totp/disable", requireAuth, csrfProtection, totpController.disable);
router.patch("/api/auth/totp/activate", requireAuth, csrfProtection, totpController.activate);
router.delete("/api/auth/totp/delete", requireAuth, csrfProtection, totpController.remove);

// ---- TOTP 2FA verification (during login with MFA pending token) ----
// Rate-limited to throttle brute-forcing the 6-digit TOTP code.
router.post("/api/auth/2fa/verify", loginRateLimiter, requireMfaPending, csrfProtection, totpController.verifyLogin);

export { router as authRouter };
