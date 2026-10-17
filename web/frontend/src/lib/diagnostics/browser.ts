interface BrowserEvent { severity: "warn" | "error"; source: "frontend" | "frontend-resource" | "frontend-api"; message: string; stack?: string; module?: string; url?: string; requestId?: string; status?: number }
declare global { interface Window { __lxpDiagnosticsQueue?: BrowserEvent[]; __lxpDiagnosticsInstalled?: boolean; __lxpDiagnosticsEarly?: boolean } }
const endpoint = "/api/telemetry/errors";
export function installBrowserDiagnostics(): void {
  if (typeof window === "undefined" || window.__lxpDiagnosticsInstalled) return;
  window.__lxpDiagnosticsInstalled = true;
  const queue = window.__lxpDiagnosticsQueue ||= [];
  const originalFetch = window.fetch.bind(window); let sending = false; let dropped = 0; let retryAt = 0;
  const text = (value: unknown): string => {
    try { return value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value); } catch { return String(value); }
  };
  const redact = (value: string) => value.replace(/((?:password|passwd|token|secret|api[_-]?key|ticket)["']?\s*[=:]\s*["']?)[^\s,"';&}\]]+/gi, "$1[redacted]").replace(/\bBearer\s+\S+/gi, "Bearer [redacted]");
  const normalize = (event: BrowserEvent): BrowserEvent => {
    let url = event.url || location.pathname;
    try { const parsed = new URL(url, location.href); url = parsed.origin + parsed.pathname; } catch { url = url.split(/[?#]/)[0]!; }
    return { ...event, message: redact(event.message || "Error").slice(0, 3000), stack: event.stack ? redact(event.stack).slice(0, 6000) : undefined,
      url: redact(url).slice(0, 1500), module: (event.module || location.pathname.split("/").filter(Boolean)[1] || "runtime").slice(0, 128), requestId: event.requestId && /^[A-Za-z0-9._-]{1,64}$/.test(event.requestId) ? event.requestId : undefined };
  };
  // Early listeners use this same queue before the module is loaded.
  for (let index = 0; index < queue.length; index++) queue[index] = normalize(queue[index]!);
  const record = (event: BrowserEvent) => {
    if (queue.length >= 100) { dropped++; return; }
    queue.push(normalize(event));
  };
  if (!window.__lxpDiagnosticsEarly) window.addEventListener("error", (event: Event) => {
    if (event instanceof ErrorEvent) record({ severity: "error", source: "frontend", message: event.message || "Script error", stack: event.error?.stack, url: event.filename || location.pathname });
    else { const target = event.target as HTMLScriptElement | HTMLLinkElement; record({ severity: "error", source: "frontend-resource", message: `Resource failed: ${target?.tagName || "resource"}`, url: (target as HTMLScriptElement)?.src || (target as HTMLLinkElement)?.href }); }
  }, true);
  if (!window.__lxpDiagnosticsEarly) window.addEventListener("unhandledrejection", (event) => { if (event.reason?.name !== "AbortError") record({ severity: "error", source: "frontend", message: text(event.reason), stack: event.reason?.stack }); });
  for (const method of ["warn", "error"] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => { record({ severity: method === "warn" ? "warn" : "error", source: "frontend", message: args.map(text).join(" "), stack: args.find((a) => a instanceof Error)?.stack }); original(...args); };
  }
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const raw = args[0] instanceof Request ? args[0].url : String(args[0]);
    let url: URL | undefined; try { url = new URL(raw, location.href); } catch { /* native fetch handles bad inputs */ }
    const excluded = url?.pathname.includes(endpoint) || url?.pathname.startsWith("/api/module-dev/logs");
    try {
      const response = await originalFetch(...args);
      if (!excluded && !response.ok) record({ severity: response.status >= 500 ? "error" : "warn", source: "frontend-api", message: `${args[1]?.method || (args[0] instanceof Request ? args[0].method : "GET")} ${url?.pathname || "request"} → ${response.status}`,
        url: url ? `${url.origin}${url.pathname}` : undefined, requestId: response.headers.get("X-Request-Id") || undefined, status: response.status });
      return response;
    } catch (error) {
      if (!excluded && (error as Error)?.name !== "AbortError") record({ severity: "error", source: "frontend-api", message: (error as Error)?.message || "Network request failed", url: url ? `${url.origin}${url.pathname}` : undefined });
      throw error;
    }
  };
  async function flush(): Promise<void> {
    if (sending || !queue.length || !navigator.onLine || Date.now() < retryAt) return;
    if (dropped && queue.length < 100) { queue.push({ severity: "warn", source: "frontend", module: "telemetry", message: `${dropped} browser diagnostic events exceeded the local queue limit` }); dropped = 0; }
    const batch: BrowserEvent[] = [];
    while (queue.length && batch.length < 20) {
      const candidate = [...batch, normalize(queue[0]!)];
      if (new TextEncoder().encode(JSON.stringify({ events: candidate })).length > 60000) break;
      batch.push(normalize(queue.shift()!));
    }
    if (!batch.length) { queue.shift(); dropped++; return; }
    sending = true;
    try {
      const response = await originalFetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: batch }), keepalive: true });
      if (!response.ok) throw new Error("Telemetry unavailable"); retryAt = 0;
    } catch { queue.unshift(...batch); if (queue.length > 100) { dropped += queue.length - 100; queue.length = 100; } retryAt = Date.now() + 15000; }
    finally { sending = false; }
  }
  window.addEventListener("online", () => { retryAt = 0; void flush(); });
  window.addEventListener("pagehide", () => {
    if (!queue.length || sending) return;
    const batch = queue.slice(0, 3).map(normalize); const body = JSON.stringify({ events: batch });
    if (new TextEncoder().encode(body).length <= 60000 && navigator.sendBeacon?.(endpoint, new Blob([body], { type: "application/json" }))) queue.splice(0, batch.length);
  });
  window.setInterval(() => { void flush(); }, 3000); void flush();
}
