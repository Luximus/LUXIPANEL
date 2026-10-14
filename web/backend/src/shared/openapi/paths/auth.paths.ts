// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenAPI path definitions — Auth module.
 */

import { z } from "zod";
import { registry } from "../registry.js";
import {
  LoginBodySchema,
  LoginResponseSchema,
  SessionUserSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
} from "../schemas.js";

const tag = "Auth";

registry.registerPath({
  method: "post",
  path: "/api/login",
  tags: [tag],
  summary: "Login with username and password",
  security: [],
  request: { body: { content: { "application/json": { schema: LoginBodySchema } } } },
  responses: {
    200: { description: "Login successful", content: { "application/json": { schema: LoginResponseSchema } } },
    401: { description: "Invalid credentials", content: { "application/json": { schema: ErrorResponseSchema } } },
    429: { description: "Rate limit exceeded", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/session",
  tags: [tag],
  summary: "Get current session",
  responses: {
    200: {
      description: "Active session",
      content: {
        "application/json": {
          schema: z.object({ ok: z.literal(true), user: SessionUserSchema }),
        },
      },
    },
    401: { description: "Not authenticated", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/logout",
  tags: [tag],
  summary: "Logout and clear session cookie",
  responses: {
    200: { description: "Logged out", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/otp/request",
  tags: [tag],
  summary: "Request a one-time password (WhatsApp/preview)",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ username: z.string() }),
        },
      },
    },
  },
  responses: {
    200: { description: "OTP sent", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "User not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/otp/verify",
  tags: [tag],
  summary: "Verify OTP code",
  security: [],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ username: z.string(), code: z.string() }),
        },
      },
    },
  },
  responses: {
    200: { description: "OTP verified, session created", content: { "application/json": { schema: LoginResponseSchema } } },
    401: { description: "Invalid OTP", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/passkeys",
  tags: [tag],
  summary: "List registered passkeys for the current user",
  responses: {
    200: {
      description: "Passkey list",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.array(z.object({
              id: z.string(),
              name: z.string().nullable(),
              createdAt: z.string().datetime(),
              lastUsedAt: z.string().datetime().nullable(),
            })),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/passkeys/register-options",
  tags: [tag],
  summary: "Get WebAuthn registration options",
  responses: {
    200: { description: "Registration options (pass to navigator.credentials.create)" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/passkeys/register-verify",
  tags: [tag],
  summary: "Verify and save a new passkey",
  responses: {
    200: { description: "Passkey registered", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/auth/passkeys/{id}",
  tags: [tag],
  summary: "Revoke a passkey",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Passkey revoked", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/recovery/status",
  tags: [tag],
  summary: "Get recovery codes status",
  responses: {
    200: {
      description: "Recovery status",
      content: {
        "application/json": {
          schema: z.object({ ok: z.literal(true), generated: z.boolean(), count: z.number().int() }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/recovery/generate",
  tags: [tag],
  summary: "Generate new recovery codes (replaces existing)",
  responses: {
    200: {
      description: "New recovery codes (shown only once)",
      content: {
        "application/json": {
          schema: z.object({ ok: z.literal(true), codes: z.array(z.string()) }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/qr/request",
  tags: [tag],
  summary: "Request QR auth token (desktop initiates)",
  security: [],
  responses: {
    200: {
      description: "QR request created",
      content: {
        "application/json": {
          schema: z.object({ ok: z.literal(true), requestId: z.string(), qrData: z.string() }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/qr/poll/{requestId}",
  tags: [tag],
  summary: "Poll QR auth status (desktop polls until approved)",
  security: [],
  request: { params: z.object({ requestId: z.string() }) },
  responses: {
    200: {
      description: "Poll result",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            status: z.enum(["pending", "approved", "expired"]),
            token: z.string().optional(),
          }),
        },
      },
    },
  },
});
