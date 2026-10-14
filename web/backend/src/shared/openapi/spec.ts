// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenAPI spec builder.
 *
 * Assembles the full OpenAPI 3.1 document from the registry.
 * All path registrations happen as side-effects when the path
 * modules are imported. Call generateSpec() after imports to
 * produce the final document.
 */

import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry.js";
import { authConfig } from "../../config/auth.js";
import { env } from "../../config/env.js";
import { APP_VERSION, APP_VERSION_DISPLAY } from "../../config/version.js";

// Import path registrations — side-effect imports
import "./paths/auth.paths.js";
import "./paths/mail.paths.js";
import "./paths/users.paths.js";
import "./paths/monitor.paths.js";
import "./paths/admin.paths.js";
import "./paths/misc.paths.js";

export interface SpecOptions {
  version?: string;
  serverUrl?: string;
}

let _cachedSpec: ReturnType<OpenApiGeneratorV31["generateDocument"]> | null = null;

/**
 * Generate (or return cached) the OpenAPI document.
 */
export function generateSpec(
  options: SpecOptions = {},
): ReturnType<OpenApiGeneratorV31["generateDocument"]> {
  if (_cachedSpec) return _cachedSpec;

  // Security schemes must be registered on the registry, not passed to generateDocument
  registry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: authConfig.cookie.sessionName,
    description: "JWT session cookie set by POST /api/login",
  });
  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "JWT or API key (lxp_...)",
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);

  _cachedSpec = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "LUXIPANEL API",
      description: [
        `REST API for LUXIPANEL ${APP_VERSION_DISPLAY} — a modular server management panel.`,
        "",
        "## Authentication",
        "Most endpoints require a valid session. Send the session cookie set by `POST /api/login`,",
        "or pass the JWT as `Authorization: Bearer <token>`.",
        "",
        "## CSRF",
        "State-mutating requests (POST/PUT/PATCH/DELETE) require the `X-CSRF-Token` header.",
        `The CSRF token is available from the \`${authConfig.cookie.csrfName}\` cookie set on every response.`,
        "",
        "## API Keys",
        "Machine-to-machine access is possible with API keys (prefix `lxp_`).",
        "Pass them as `Authorization: Bearer lxp_...`.",
      ].join("\n"),
      version: options.version ?? APP_VERSION,
      contact: { name: "LUXIPANEL", url: "https://github.com/luxipanel/luxipanel" },
      license: { name: "MIT" },
    },
    servers: [
      {
        url: options.serverUrl ?? `http://localhost:${env.PORT}`,
        description: "Local development",
      },
      {
        url: "https://{domain}",
        description: "Production",
        variables: {
          domain: {
            default: "panel.example.com",
            description: "Your panel domain",
          },
        },
      },
    ],
    security: [{ cookieAuth: [] }, { bearerAuth: [] }],
    tags: [
      { name: "Auth", description: "Authentication, sessions, passkeys, OTP, QR login" },
      { name: "Users", description: "Panel user management, roles, preferences" },
      { name: "Roles", description: "Role-based access control" },
      { name: "Mail Accounts", description: "Virtual mailbox CRUD and forwards" },
      { name: "Mail", description: "IMAP mailbox operations and SMTP send" },
      { name: "Monitor", description: "Real-time system metrics and alert rules" },
      { name: "Monitor Alerts", description: "Alert rule management and event history" },
      { name: "Admin", description: "System configuration, sync, and logs" },
      { name: "SSL", description: "Let's Encrypt certificate management" },
      { name: "Files", description: "Server file manager" },
      { name: "Firewall", description: "UFW rules and Fail2ban management" },
      { name: "Cron", description: "Cron job management" },
      { name: "Webhooks", description: "Webhook subscriptions with HMAC signing" },
      { name: "API Keys", description: "API key generation and revocation" },
      { name: "Backup", description: "Backup jobs and schedules" },
      { name: "DNS", description: "DNS zone and record management" },
      { name: "AI Assistant", description: "AI-powered server diagnostics and chat" },
      { name: "Terminal", description: "Web terminal session management (WebSocket)" },
    ],
  });

  return _cachedSpec;
}
