// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenAPI path definitions — Mail module.
 */

import { z } from "zod";
import { registry } from "../registry.js";
import {
  MailAccountSchema,
  ForwardSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
  PaginationMetaSchema,
} from "../schemas.js";

const tag = "Mail";
const accountTag = "Mail Accounts";

// ── Accounts ──────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/accounts",
  tags: [accountTag],
  summary: "List all mail accounts",
  request: {
    query: z.object({
      page: z.coerce.number().int().default(1).optional(),
      limit: z.coerce.number().int().default(20).optional(),
      q: z.string().optional().openapi({ description: "Search by email" }),
    }),
  },
  responses: {
    200: {
      description: "Mail accounts list",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.array(MailAccountSchema),
          }).merge(PaginationMetaSchema),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/accounts",
  tags: [accountTag],
  summary: "Create a mail account",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
            password: z.string().min(8),
            quota: z.number().int().optional(),
            enabled: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Account created", content: { "application/json": { schema: z.object({ ok: z.literal(true), data: MailAccountSchema }) } } },
    409: { description: "Email already exists", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/accounts/{id}",
  tags: [accountTag],
  summary: "Update a mail account",
  request: {
    params: z.object({ id: z.coerce.number().int() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            password: z.string().min(8).optional(),
            quota: z.number().int().optional(),
            enabled: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: z.object({ ok: z.literal(true), data: MailAccountSchema }) } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/accounts/{id}",
  tags: [accountTag],
  summary: "Delete a mail account",
  request: { params: z.object({ id: z.coerce.number().int() }) },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// ── Forwards ─────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/accounts/{accountId}/forwards",
  tags: [accountTag],
  summary: "List forwards for an account",
  request: { params: z.object({ accountId: z.coerce.number().int() }) },
  responses: {
    200: {
      description: "Forwards list",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: z.array(ForwardSchema) }) } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/accounts/{accountId}/forwards",
  tags: [accountTag],
  summary: "Replace all forwards for an account",
  request: {
    params: z.object({ accountId: z.coerce.number().int() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ destinations: z.array(z.string().email()) }),
        },
      },
    },
  },
  responses: {
    200: { description: "Forwards replaced", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

// ── Mailbox (IMAP) ────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/mail/{accountId}/folders",
  tags: [tag],
  summary: "List IMAP folders",
  request: { params: z.object({ accountId: z.coerce.number().int() }) },
  responses: {
    200: {
      description: "Folder list",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.array(z.object({ name: z.string(), delimiter: z.string(), flags: z.array(z.string()) })),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/mail/{accountId}/messages",
  tags: [tag],
  summary: "List messages in a folder",
  request: {
    params: z.object({ accountId: z.coerce.number().int() }),
    query: z.object({
      folder: z.string().optional(),
      page: z.coerce.number().int().optional(),
      limit: z.coerce.number().int().optional(),
    }),
  },
  responses: {
    200: { description: "Message list (headers only)" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/mail/{accountId}/messages/{uid}",
  tags: [tag],
  summary: "Fetch a full message",
  request: {
    params: z.object({ accountId: z.coerce.number().int(), uid: z.coerce.number().int() }),
  },
  responses: {
    200: { description: "Full message with body and attachments" },
    404: { description: "Message not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/mail/{accountId}/send",
  tags: [tag],
  summary: "Send an email",
  request: {
    params: z.object({ accountId: z.coerce.number().int() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            to: z.array(z.string().email()),
            cc: z.array(z.string().email()).optional(),
            bcc: z.array(z.string().email()).optional(),
            subject: z.string(),
            text: z.string().optional(),
            html: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Email sent", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});
