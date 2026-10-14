/** Only text diagnostics: omit object payloads and credentials from URLs/stacks. */
export function formatDevelopmentError(value: unknown) {
  const text = value instanceof Error ? `${value.name}: ${value.message}\n${value.stack ?? ""}` : typeof value === "string" ? value : "[non-text diagnostic omitted]";
  return text.replace(/https?:\/\/[^\s)]+/g, url => url.split("?")[0])
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted token]")
    .slice(0, 12000);
}

/** Restore error forwarding to the connected Metro session in bridgeless RN. */
export function installDevelopmentErrorLogging() {
  if (!__DEV__) return;
  const runtime = globalThis as typeof globalThis & {
    __luxipanelErrorLogging?: boolean;
    __luxipanelDevelopmentInfo?: (message: string) => void;
    ErrorUtils?: {
      getGlobalHandler(): (error: Error, fatal?: boolean) => void;
      setGlobalHandler(handler: (error: Error, fatal?: boolean) => void): void;
    };
  };
  if (runtime.__luxipanelErrorLogging) return;
  try {
    const server = require("react-native/Libraries/Core/Devtools/getDevServer").default();
    if (!server.bundleLoadedFromServer) return;
    // The regular HMR client starts after root registration. A failed startup
    // import never reaches that point, so use Metro's existing log protocol.
    const socket = new WebSocket(`${server.url.replace(/^http/, "ws")}hot`);
    const pending: string[] = [];
    const send = (level: string, data: string[]) => {
      const message = JSON.stringify({ type: "log", level, mode: "NOBRIDGE", data });
      if (socket.readyState === WebSocket.OPEN) socket.send(message);
      else if (pending.length < 30) pending.push(message);
    };
    socket.onopen = () => { for (const message of pending.splice(0)) socket.send(message); };
    socket.onerror = () => {};
    runtime.__luxipanelDevelopmentInfo = message => send("info", ["[LUXIPANEL runtime]", formatDevelopmentError(message)]);
    const report = (values: unknown[]) => {
      try { send("error", ["[LUXIPANEL runtime]", ...values.map(formatDevelopmentError)]); } catch { /* diagnostics never interfere with error handling */ }
    };
    const original = console.error;
    console.error = (...values: unknown[]) => { report(values); original.apply(console, values); };
    const handler = runtime.ErrorUtils?.getGlobalHandler();
    if (handler) runtime.ErrorUtils!.setGlobalHandler((error, fatal) => { report([error]); handler(error, fatal); });
    runtime.__luxipanelErrorLogging = true;
    send("info", ["[LUXIPANEL runtime]", "development diagnostics installed"]);
    try {
      const app = require("expo-application");
      const constants = require("expo-constants").default;
      send("info", ["[LUXIPANEL runtime]", `client=${app.nativeApplicationVersion ?? "unknown"} build=${app.nativeBuildVersion ?? "unknown"} environment=${constants.executionEnvironment}`]);
    } catch { /* Fingerprinting is optional, errors still get reported. */ }
  } catch { /* Keep the normal debugger when Metro logging is unavailable. */ }
}

/** Development-only, sanitized confirmation that a UI revision actually rendered. */
export function reportDevelopmentInfo(message: string) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  try {
    (globalThis as typeof globalThis & { __luxipanelDevelopmentInfo?: (message: string) => void }).__luxipanelDevelopmentInfo?.(message);
  } catch { /* Diagnostics must never affect the UI. */ }
}
