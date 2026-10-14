// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenAPI path definitions — Users & Roles module.
 */

import { z } from "zod";
import { registry } from "../registry.js";
import {
  PanelUserSchema,
  RoleSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
} from "../schemas.js";

const userTag = "Users";
const roleTag = "Roles";

// ── Users ─────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/users",
  tags: [userTag],
  summary: "List panel users (admin only)",
  request: {
    query: z.object({
      page: z.coerce.number().int().optional(),
      limit: z.coerce.number().int().optional(),
    }),
  },
  responses: {
    200: {
      description: "User list",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: z.array(PanelUserSchema) }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/users",
  tags: [userTag],
  summary: "Create a panel user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            username: z.string(),
            password: z.string().min(8),
            displayName: z.string().optional(),
            email: z.string().email().optional(),
            roleId: z.number().int().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "User created", content: { "application/json": { schema: z.object({ ok: z.literal(true), data: PanelUserSchema }) } } },
    409: { description: "Username taken", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/users/{id}",
  tags: [userTag],
  summary: "Update a panel user",
  request: {
    params: z.object({ id: z.coerce.number().int() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            displayName: z.string().optional(),
            email: z.string().email().optional(),
            roleId: z.number().int().nullable().optional(),
            enabled: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: z.object({ ok: z.literal(true), data: PanelUserSchema }) } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/users/{id}",
  tags: [userTag],
  summary: "Delete a panel user",
  request: { params: z.object({ id: z.coerce.number().int() }) },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/users/{id}/password",
  tags: [userTag],
  summary: "Change a user's password (admin — no current password required)",
  request: {
    params: z.object({ id: z.coerce.number().int() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ password: z.string().min(8) }),
        },
      },
    },
  },
  responses: {
    200: { description: "Password changed", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

// ── Roles ─────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/roles",
  tags: [roleTag],
  summary: "List all roles",
  responses: {
    200: {
      description: "Role list",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: z.array(RoleSchema) }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/roles",
  tags: [roleTag],
  summary: "Create a role",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string(),
            description: z.string().optional(),
            modules: z.array(z.string()),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Role created", content: { "application/json": { schema: z.object({ ok: z.literal(true), data: RoleSchema }) } } },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/roles/{id}",
  tags: [roleTag],
  summary: "Update a role",
  request: {
    params: z.object({ id: z.coerce.number().int() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().optional(),
            description: z.string().optional(),
            modules: z.array(z.string()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Updated" },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/roles/{id}",
  tags: [roleTag],
  summary: "Delete a role",
  request: { params: z.object({ id: z.coerce.number().int() }) },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

// ── Preferences (self-service) ────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/preferences",
  tags: [userTag],
  summary: "Get current user's preferences",
  responses: {
    200: {
      description: "User preferences",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.object({
              theme: z.enum(["light", "dark", "system"]).optional(),
              language: z.string().optional(),
              notificationsEnabled: z.boolean().optional(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/preferences",
  tags: [userTag],
  summary: "Update current user's preferences",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            theme: z.enum(["light", "dark", "system"]).optional(),
            language: z.string().optional(),
            notificationsEnabled: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Preferences updated", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/preferences/password",
  tags: [userTag],
  summary: "Change own password (requires current password)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            currentPassword: z.string(),
            newPassword: z.string().min(8),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Password changed", content: { "application/json": { schema: SuccessResponseSchema } } },
    401: { description: "Current password incorrect", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});
