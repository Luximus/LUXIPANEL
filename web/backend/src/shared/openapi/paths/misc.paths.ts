// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenAPI path definitions — Files, Firewall, Cron,
 * Webhooks, Backup, DNS, AI Assistant, Terminal modules.
 */

import { z } from "zod";
import { registry } from "../registry.js";
import {
  WebhookSchema,
  ApiKeySchema,
  BackupJobSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
} from "../schemas.js";

// ── Files ─────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/files/browse",
  tags: ["Files"],
  summary: "List directory contents",
  request: { query: z.object({ path: z.string().openapi({ example: "/var/www" }) }) },
  responses: {
    200: { description: "Directory listing" },
    403: { description: "Path not allowed", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/files/read",
  tags: ["Files"],
  summary: "Read a text file (max 2MB)",
  request: { query: z.object({ path: z.string() }) },
  responses: {
    200: { description: "File contents" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/files/write",
  tags: ["Files"],
  summary: "Write a text file",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ path: z.string(), content: z.string() }),
        },
      },
    },
  },
  responses: {
    200: { description: "File written", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/files/upload",
  tags: ["Files"],
  summary: "Upload a file (octet-stream, max 10MB)",
  request: { query: z.object({ path: z.string() }) },
  responses: {
    200: { description: "File uploaded", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

// ── Firewall ──────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/firewall/status",
  tags: ["Firewall"],
  summary: "UFW overview + Fail2ban jail summary",
  responses: {
    200: { description: "Firewall status" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/firewall/rules",
  tags: ["Firewall"],
  summary: "List UFW rules",
  responses: {
    200: { description: "UFW rules list" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/firewall/rules",
  tags: ["Firewall"],
  summary: "Add a UFW rule",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            port: z.number().int().or(z.string()),
            proto: z.enum(["tcp", "udp", "any"]).optional(),
            action: z.enum(["allow", "deny"]),
            from: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Rule added", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/firewall/fail2ban/{jail}/unban",
  tags: ["Firewall"],
  summary: "Unban an IP from a Fail2ban jail",
  request: {
    params: z.object({ jail: z.string() }),
    body: { content: { "application/json": { schema: z.object({ ip: z.string() }) } } },
  },
  responses: {
    200: { description: "IP unbanned", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

// ── Cron ──────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/cron/jobs",
  tags: ["Cron"],
  summary: "List cron jobs",
  responses: {
    200: {
      description: "Cron jobs",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.array(z.object({
              index: z.number().int(),
              schedule: z.string().openapi({ example: "0 2 * * *" }),
              command: z.string(),
              user: z.string(),
            })),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/cron/jobs",
  tags: ["Cron"],
  summary: "Add a cron job",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            schedule: z.string().openapi({ example: "*/5 * * * *" }),
            command: z.string(),
            user: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Cron job added", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

// ── Webhooks ──────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/webhooks",
  tags: ["Webhooks"],
  summary: "List webhooks",
  responses: {
    200: {
      description: "Webhooks",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: z.array(WebhookSchema) }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/webhooks",
  tags: ["Webhooks"],
  summary: "Create a webhook",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string(),
            url: z.string().url(),
            events: z.array(z.string()),
            secret: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Webhook created (secret shown once)", content: { "application/json": { schema: z.object({ ok: z.literal(true), data: WebhookSchema, secret: z.string() }) } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/webhooks/{id}/rotate-secret",
  tags: ["Webhooks"],
  summary: "Rotate webhook signing secret",
  request: { params: z.object({ id: z.coerce.number().int() }) },
  responses: {
    200: { description: "New secret", content: { "application/json": { schema: z.object({ ok: z.literal(true), secret: z.string() }) } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/api-keys",
  tags: ["API Keys"],
  summary: "List API keys",
  responses: {
    200: {
      description: "API keys",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: z.array(ApiKeySchema) }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/api-keys",
  tags: ["API Keys"],
  summary: "Generate a new API key (shown in full only once)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string(),
            scopes: z.array(z.string()),
            expiresAt: z.string().datetime().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "API key created", content: { "application/json": { schema: z.object({ ok: z.literal(true), key: z.string(), data: ApiKeySchema }) } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/api-keys/{id}",
  tags: ["API Keys"],
  summary: "Revoke an API key",
  request: { params: z.object({ id: z.coerce.number().int() }) },
  responses: {
    200: { description: "Revoked", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

// ── Backup ─────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/backups",
  tags: ["Backup"],
  summary: "List backup jobs",
  responses: {
    200: {
      description: "Backup jobs",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: z.array(BackupJobSchema) }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/backups",
  tags: ["Backup"],
  summary: "Trigger a manual backup",
  request: {
    body: { content: { "application/json": { schema: z.object({ type: z.string().default("full") }) } } },
  },
  responses: {
    201: { description: "Backup job queued", content: { "application/json": { schema: z.object({ ok: z.literal(true), data: BackupJobSchema }) } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/backups/{id}",
  tags: ["Backup"],
  summary: "Delete a backup job and its archive",
  request: { params: z.object({ id: z.coerce.number().int() }) },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// ── NGINX ──────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/nginx/sites",
  tags: ["NGINX"],
  summary: "List NGINX server blocks",
  responses: {
    200: {
      description: "Sites list",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.array(z.object({
              name: z.string(),
              enabled: z.boolean(),
              domains: z.array(z.string()),
              ssl: z.boolean(),
            })),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/nginx/status",
  tags: ["NGINX"],
  summary: "NGINX service status (version, running, last nginx -t)",
  responses: {
    200: { description: "Status", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/nginx/service",
  tags: ["NGINX"],
  summary: "Control the nginx service (start|stop|restart|reload|test)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ action: z.enum(["start", "stop", "restart", "reload", "test"]) }),
        },
      },
    },
  },
  responses: {
    200: { description: "Action result", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

// ── AI Assistant ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: "/api/ai/chat",
  tags: ["AI Assistant"],
  summary: "Chat with the AI assistant (server context injected automatically)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({ example: "Why is my mail server rejecting emails?" }),
            history: z.array(z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "AI response",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.object({
              content: z.string(),
              model: z.string(),
              tokensUsed: z.number().optional(),
            }),
          }),
        },
      },
    },
    503: { description: "AI provider not configured", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/ai/diagnostics",
  tags: ["AI Assistant"],
  summary: "Run DKIM/SPF/DMARC/rDNS/MX diagnostics with AI analysis",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ domain: z.string() }),
        },
      },
    },
  },
  responses: {
    200: { description: "Diagnostic results with AI commentary" },
  },
});

// ── Terminal ───────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/terminal/sessions",
  tags: ["Terminal"],
  summary: "List active WebSocket terminal sessions",
  responses: {
    200: {
      description: "Active sessions",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.array(z.object({
              sessionId: z.string(),
              userId: z.number().int(),
              username: z.string(),
              pid: z.number().int(),
              createdAt: z.string().datetime(),
              lastActivityAt: z.string().datetime(),
            })),
            total: z.number().int(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/terminal/sessions/{sessionId}",
  tags: ["Terminal"],
  summary: "Force-close a terminal session",
  request: { params: z.object({ sessionId: z.string() }) },
  responses: {
    200: { description: "Session closed", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Session not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});
