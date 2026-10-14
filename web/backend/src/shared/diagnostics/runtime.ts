import { format } from "node:util";
import { diagnosticsStore } from "./store.js";
import type { Severity } from "./types.js";
import { diagnosticContext, diagnosticScope } from "./context.js";

/** Proxy also observes disabled Pino levels. Pino's hooks alone skip these. */
export function observeLogger<T extends object>(logger: T): T {
  return new Proxy(logger, {
    get(target, key, receiver) {
      const original = Reflect.get(target, key, receiver);
      if (key === "child" && typeof original === "function") return (...args: unknown[]) => observeLogger(original.apply(target, args));
      if (["warn", "error", "fatal"].includes(String(key)) && typeof original === "function") return (...args: unknown[]) => {
        const first = args[0]; const obj = first && typeof first === "object" ? first as Record<string, unknown> : {};
        const error = obj.err || (first instanceof Error ? first : undefined);
        const bindings = (target as { bindings?: () => Record<string, unknown> }).bindings?.() || {};
        const id = diagnosticsStore.capture({ severity: key as Severity, module: String(obj.module || bindings.module || "runtime"), source: obj.status || obj.statusCode ? "api" : "backend",
          message: typeof first === "string" ? format(...args) : typeof args[1] === "string" ? format(...args.slice(1)) : String((error as Error)?.message || "Error"),
          stack: (error as Error)?.stack, details: { ...bindings, ...obj }, requestId: obj.requestId as string | undefined,
          url: obj.url as string | undefined, status: (obj.status || obj.statusCode) as number | undefined });
        const metadata = { diagnosticId: id, diagnosticScope: diagnosticScope(diagnosticContext.getStore()?.().user) };
        const annotated = typeof first === "object" && first !== null ? [{ ...(first instanceof Error ? { err: first } : obj), ...metadata }, ...args.slice(1)] : [metadata, ...args];
        return original.apply(target, annotated);
      };
      return original;
    },
  });
}
let installed = false;
export function installRuntimeDiagnostics(): void {
  if (installed) return; installed = true;
  for (const method of ["warn", "error"] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => { diagnosticsStore.capture({ severity: method === "warn" ? "warn" : "error", source: "backend", module: "console", message: format(...args), stack: args.find((a) => a instanceof Error)?.stack }); original(...args); };
  }
  process.on("warning", (error) => diagnosticsStore.capture({ severity: "warn", module: "process", message: error.message, stack: error.stack }));
}
