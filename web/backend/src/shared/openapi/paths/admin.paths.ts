// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenAPI path definitions — Admin module.
 */

import { z } from "zod";
import { registry } from "../registry.js";
import { ErrorResponseSchema, SuccessResponseSchema } from "../schemas.js";

const tag = "Admin";

registry.registerPath({
  method: "get",
  path: "/api/admin/settings",
  tags: [tag],
  summary: "List all system settings",
  responses: {
    200: {
      description: "Settings key-value pairs",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.array(z.object({ key: z.string(), value: z.string().nullable() })),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/admin/settings/{key}",
  tags: [tag],
  summary: "Set a system setting",
  request: {
    params: z.object({ key: z.string() }),
    body: { content: { "application/json": { schema: z.object({ value: z.string() }) } } },
  },
  responses: {
    200: { description: "Setting updated", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/admin/system/health",
  tags: [tag],
  summary: "Deep health check (DB + Redis + services)",
  responses: {
    200: { description: "All services healthy" },
    503: { description: "One or more services degraded", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/admin/system/env",
  tags: [tag],
  summary: "Current environment config (secrets redacted)",
  responses: {
    200: {
      description: "Env config",
      content: {
        "application/json": {
          schema: z.object({ ok: z.literal(true), data: z.record(z.string()) }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/admin/sync/dovecot",
  tags: [tag],
  summary: "Sync Dovecot users file and reload",
  responses: {
    200: { description: "Synced", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/admin/sync/all",
  tags: [tag],
  summary: "Sync all mail services (Dovecot → Postfix → Sieve)",
  responses: {
    200: { description: "All synced", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/admin/logs/{service}",
  tags: [tag],
  summary: "View journalctl logs for a service",
  request: {
    params: z.object({ service: z.string().openapi({ example: "postfix" }) }),
    query: z.object({ lines: z.coerce.number().int().optional() }),
  },
  responses: {
    200: {
      description: "Log entries",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.array(z.object({
              ts: z.string(),
              level: z.string(),
              message: z.string(),
            })),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/admin/services/{service}/restart",
  tags: [tag],
  summary: "Restart a managed service",
  request: { params: z.object({ service: z.string() }) },
  responses: {
    200: { description: "Service restarted", content: { "application/json": { schema: SuccessResponseSchema } } },
    403: { description: "Service not in allowlist", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});
