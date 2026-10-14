// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenAPI path definitions — Monitor module.
 */

import { z } from "zod";
import { registry } from "../registry.js";
import {
  StatsSnapshotSchema,
  AlertRuleSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
} from "../schemas.js";

const tag = "Monitor";
const alertTag = "Monitor Alerts";

registry.registerPath({
  method: "get",
  path: "/api/monitor/system",
  tags: [tag],
  summary: "Current system stats snapshot",
  responses: {
    200: {
      description: "Latest metrics",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: StatsSnapshotSchema }) } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/monitor/history",
  tags: [tag],
  summary: "Historical stats (last 24h from Redis ring-buffer)",
  request: {
    query: z.object({
      from: z.coerce.number().optional().openapi({ description: "Unix ms" }),
      to: z.coerce.number().optional().openapi({ description: "Unix ms" }),
    }),
  },
  responses: {
    200: {
      description: "Array of snapshots",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: z.array(StatsSnapshotSchema) }) } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/monitor/services",
  tags: [tag],
  summary: "Status of key systemd services",
  responses: {
    200: {
      description: "Service status list",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.array(z.object({
              name: z.string(),
              active: z.boolean(),
              status: z.string(),
            })),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/monitor/stream",
  tags: [tag],
  summary: "Server-Sent Events stream — pushes StatsSnapshot every 5s",
  responses: {
    200: {
      description: "SSE stream (text/event-stream). Events: connected, stats, alert:firing, alert:resolved",
    },
  },
});

// ── Alerts ────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/monitor/alerts",
  tags: [alertTag],
  summary: "List alert rules",
  responses: {
    200: {
      description: "Alert rules",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: z.array(AlertRuleSchema) }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/monitor/alerts",
  tags: [alertTag],
  summary: "Create an alert rule",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string(),
            metric: z.enum([
              "cpu_usage_percent", "memory_usage_percent", "disk_usage_percent",
              "load_avg_1m", "load_avg_5m", "rx_bytes_per_sec", "tx_bytes_per_sec",
            ]),
            operator: z.enum(["gt", "lt", "gte", "lte"]),
            threshold: z.number(),
            sustainedSamples: z.number().int().min(1).default(1),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Alert rule created", content: { "application/json": { schema: z.object({ ok: z.literal(true), data: AlertRuleSchema }) } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/monitor/alerts/{id}",
  tags: [alertTag],
  summary: "Delete an alert rule",
  request: { params: z.object({ id: z.coerce.number().int() }) },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/monitor/alerts/events",
  tags: [alertTag],
  summary: "List recent alert events (firing/resolved history)",
  responses: {
    200: {
      description: "Alert events",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.array(z.object({
              id: z.number().int(),
              ruleId: z.number().int(),
              status: z.enum(["firing", "resolved"]),
              metricValue: z.number(),
              firedAt: z.string().datetime(),
              resolvedAt: z.string().datetime().nullable(),
            })),
          }),
        },
      },
    },
  },
});
