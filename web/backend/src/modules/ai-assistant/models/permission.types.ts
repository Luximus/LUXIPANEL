// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Interactive permission protocol — the human-in-the-loop approval gate that
 * replaces `--dangerously-skip-permissions` for the Claude CLI provider.
 *
 * When the Claude CLI (running detached on the connected target) wants to use a
 * tool that mutates the server (Bash / Edit / Write / `servers.exec` …) it calls
 * the panel's `permissions.approve` MCP tool (wired via `--permission-prompt-tool`).
 * The handler classifies the request (see permission-policy.ts):
 *   - read-only tools          → auto-allow (no prompt, smooth UX)
 *   - mutating / unknown tools → ask the user
 *
 * For an "ask", the broker (permission-broker.ts) injects a `permission_request`
 * event into the live run (so the open SSE stream surfaces approve/deny buttons
 * in the chat bubble) and BLOCKS the MCP call until the user decides. The
 * decision returns to the CLI as the tool result, so the agent continues (allow)
 * or backs off (deny) — all within the same turn.
 */

export type PermissionDecision = "allow" | "deny";
