// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/** Match actual errors, never quoted code, user messages or successful reads. */
export function hasMcpSessionError(value: unknown, failed = false, depth = 0): boolean {
  if (depth > 8 || value == null) return false;
  if (typeof value === "string") {
    if (failed) return value.includes("MCP_SESSION_EXPIRED");
    if (!value.includes("MCP_SESSION_EXPIRED")) return false;
    try { return hasMcpSessionError(JSON.parse(value), false, depth + 1); } catch { /* JSONL stream */ }
    return value.split("\n").some(line => {
      try { return hasMcpSessionError(JSON.parse(line), false, depth + 1); } catch { return false; }
    });
  }
  if (typeof value !== "object") return false;
  const e = value as Record<string, any>;
  if (e.code === "MCP_SESSION_EXPIRED") return true;
  if (e.type === "error") return hasMcpSessionError(e.message ?? e.error, true, depth + 1);
  if (e.type === "text") return hasMcpSessionError(e.delta, false, depth + 1);
  if (e.type === "tool_result" && (e.success === false || e.is_error === true))
    return hasMcpSessionError(e.output ?? e.content, true, depth + 1);
  if (e.isError === true || (failed && Array.isArray(value)))
    return (Array.isArray(value) ? value : Array.isArray(e.content) ? e.content : []).some((c: any) => hasMcpSessionError(c.text ?? c, true, depth + 1));
  if (e.type === "item.completed") return hasMcpSessionError(e.item, false, depth + 1);
  if (e.type === "mcp_tool_call" || e.type === "mcpToolCall")
    return hasMcpSessionError(e.error?.message, true, depth + 1) || hasMcpSessionError(e.result, false, depth + 1);
  if (e.type === "user" && Array.isArray(e.message?.content))
    return e.message.content.some((c: any) => c.type === "tool_result" && hasMcpSessionError(c, false, depth + 1));
  return false;
}

export interface McpRecoveryResult { ok: boolean; stamp?: string; error?: string }
const inFlight = new Map<string, Promise<McpRecoveryResult>>();

/** Bounded silent recovery, scoped and deduplicated across mounted consumers. */
export function startMcpRecovery(options: {
  key: string;
  current: () => boolean;
  repair: () => Promise<McpRecoveryResult>;
  recovered: (result: McpRecoveryResult) => void;
  failed: (message?: string) => void;
}) {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  const current = () => !cancelled && options.current();
  const run = async () => {
    if (!current()) return;
    attempts += 1;
    let pending = inFlight.get(options.key);
    if (!pending) {
      pending = Promise.resolve().then(() => current() ? options.repair() : { ok: false }).catch(() => ({ ok: false }));
      inFlight.set(options.key, pending);
      void pending.finally(() => { if (inFlight.get(options.key) === pending) inFlight.delete(options.key); });
    }
    const result = await pending;
    if (!current()) return;
    if (result.ok) { options.recovered(result); return; }
    if (attempts >= 3) { options.failed(result.error); return; }
    timer = setTimeout(() => void run(), attempts === 1 ? 5000 : 15000);
  };
  void run();
  return () => { cancelled = true; if (timer) clearTimeout(timer); };
}
