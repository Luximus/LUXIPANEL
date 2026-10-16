// Floating terminal — xterm session lifecycle, createTerminal,
// loading overlay, WS connect/reconnect, and the shared ResizeObserver.
import { getModeInitialCommand } from "./startup";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import "./terminal-scroll.css";
import { containTerminalScroll } from "./terminal-scroll";
import { S, sessions, escapeHtml } from "./state";
import { I18N, tI18n } from "./i18n";
import { getTerminalTheme } from "./theme";
import { getTabAccentClass } from "./tabs";
import { BRIDGE_SESSION_SESSION_KEY, TARGET_SCOPE_SESSION_KEY, SERVER_SWITCHER_ID, ATTR_CURRENT_BRIDGE_SESSION_ID } from "@/lib/api-client";
import { TerminalWsMsg } from "@/lib/terminal-ws-protocol";
import { DEFAULT_BACKEND_PORT } from "@/lib/server-env";
import { FILES_CURRENT_PATH_KEY } from "../../pages/panel/files/state";
import { MOUSE_TRACKING_OFF, terminalProcessEnded, trackAlternateScreenExit } from "./terminal-lifecycle";
import {
  setStatus,
  normalizePath,
  emitTerminalCwd,
  getWebsocketToken,
  processTerminalInput,
  applyMobileKeyModifiersToTyped,
} from "./terminal-io";

  // crypto.randomUUID is only available in secure contexts (HTTPS).
  // This polyfill works on HTTP as well.
  function generateId(): string {
    if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
      return (crypto as any).randomUUID() as string;
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function createTerminal(tabId: number, options: {
    label?: string;
    initialCommand?: string | null;
    cdOnConnect?: string | null;
    suppressConnectedBanner?: boolean;
  } = {}): void {
    const container = document.createElement("div");
    container.id = `term-${tabId}`;
    container.className = "h-full";
    // El container arranca con su tamaño normal para que xterm pueda calcular
    // bien filas/columnas en su `.open()`. La visibilidad de la sesión durante
    // el bootstrap se controla con un overlay opaco encima (syncLoadingOverlay).
    container.style.display = tabId === S.activeTabId ? "block" : "none";
    document.getElementById("terminal-container")!.appendChild(container);

    const term = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: S.fontSize,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      theme: getTerminalTheme(),
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(container);
    containTerminalScroll(container);
    fitAddon.fit();

    // cd to current files path when this new tab connects
    const filesPath = (window as any).__filesCurrentPath || sessionStorage.getItem(FILES_CURRENT_PATH_KEY) || null;
  const resolvedInitialCommand = options.initialCommand === undefined ? getModeInitialCommand() : options.initialCommand;
  sessions.set(tabId, {
      term,
      ws: null,
      fitAddon,
      container,
      label: tI18n(I18N.tabLabel, { n: tabId }),
      targetScope: sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY) || "local",
      accentClass: getTabAccentClass(tabId),
    lineBuffer: "",
    cursorPos: 0,
    cwd: normalizePath(options.cdOnConnect ?? filesPath ?? "/"),
      historyIdx: -1,
      reconnectAttempts: 0,
      // Solo ocultamos la consola tras un overlay cuando hay un comando inicial
      // que arranca un TUI (Codex/Claude). En modo bash normal mostramos
      // directamente el shell para que el usuario pueda escribir desde ya.
      // Inline Codex never enters the alternate screen used by the TUI-ready
      // detector. Show it immediately, without the 30-second loading overlay.
      pendingVisibility: !!resolvedInitialCommand && !/^codex(?: resume)? --no-alt-screen(?:\s|$)/.test(resolvedInitialCommand),
      bootstrapBuffer: "",
      reconnectTimer: null,
      cdOnConnect: options.cdOnConnect ?? filesPath,
      initialCommand: resolvedInitialCommand,
      startupCommand: resolvedInitialCommand,
      suppressConnectedBanner: options.suppressConnectedBanner ?? false,
    });
    // onData belongs to the xterm instance, not to a WebSocket connection.
    // Reconnecting the socket must not add another input handler for this tab.
    term.onData((data: string) => {
      processTerminalInput(tabId, applyMobileKeyModifiersToTyped(data));
    });
    if (options.label) {
      const session = sessions.get(tabId);
      if (session) session.label = options.label;
    }
    syncLoadingOverlay();
    // Salvaguarda: si en 30s no detectamos TUI ready (p.ej. instalación lenta
    // o un comando que no abre buffer alterno), revelamos igual para que el
    // usuario no quede atrapado en el overlay.
    setTimeout(() => {
      const s = sessions.get(tabId);
      if (s?.pendingVisibility) {
        setLoadingDetail(I18N.loading.takingLonger);
        revealSession(tabId);
      }
    }, 30_000);
    connectWs(tabId);
  }

  // ── Loading overlay & visibility de sesiones pendientes ────────────────────
  // Mientras opencode arranca (instalación + bootstrap del TUI) ocultamos el
  // container xterm de la sesión y mostramos un overlay con spinner. Cuando
  // detectamos el marker `__LXP_TUI_READY__` o el escape del buffer alterno
  // (\x1b[?1049h) en la salida del WS, revelamos la sesión.
  function getLoadingOverlay(): HTMLElement | null {
    const host = document.getElementById("terminal-container");
    if (!host) return null;
    let overlay = document.getElementById("lxp-terminal-loading") as HTMLElement | null;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "lxp-terminal-loading";
      overlay.className =
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 text-muted-foreground";
      overlay.innerHTML =
        '<div class="inline-block animate-spin"><i class="ti ti-loader text-3xl text-primary"></i></div>' +
        `<p class="text-sm font-medium">${escapeHtml(I18N.loading.title)}</p>` +
        `<p id="lxp-terminal-loading-detail" class="text-xs text-muted-foreground/80">${escapeHtml(I18N.loading.detail)}</p>`;
      const parent = host.parentElement ?? host;
      if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
      parent.appendChild(overlay);
    }
    return overlay;
  }

  function syncLoadingOverlay(): void {
    const overlay = getLoadingOverlay();
    if (!overlay) return;
    const active = sessions.get(S.activeTabId);
    const shouldShow = !!active?.pendingVisibility;
    overlay.style.display = shouldShow ? "flex" : "none";
    // Cuando está oculto debe ser totalmente transparente al input para que
    // los clicks lleguen al xterm de abajo y el usuario pueda escribir.
    overlay.style.pointerEvents = shouldShow ? "auto" : "none";
  }

  function setLoadingDetail(text: string): void {
    const detail = document.getElementById("lxp-terminal-loading-detail");
    if (detail) detail.textContent = text;
  }

  function revealSession(tabId: number): void {
    const s = sessions.get(tabId);
    if (!s || !s.pendingVisibility) return;
    s.pendingVisibility = false;
    s.bootstrapBuffer = "";
    syncLoadingOverlay();
    if (tabId !== S.activeTabId) return;
    // Damos un tick al navegador para repintar tras quitar el overlay y luego
    // refit/foco para que xterm cuente filas con el tamaño real visible.
    requestAnimationFrame(() => {
      try { s.fitAddon.fit(); } catch { /* ignore */ }
      try { s.term.focus(); } catch { /* ignore */ }
      if (s.ws?.readyState === WebSocket.OPEN) {
        s.ws.send(JSON.stringify({ type: TerminalWsMsg.RESIZE, cols: s.term.cols, rows: s.term.rows }));
      }
    });
  }

  function maybeRevealOnOutput(tabId: number, data: string): void {
    const s = sessions.get(tabId);
    if (!s?.pendingVisibility) return;
    s.bootstrapBuffer = (s.bootstrapBuffer + data).slice(-12000);
    // Detectores binarios — sólo se disparan cuando bash REALMENTE ejecuta
    // el printf (los bytes de escape no están presentes en el eco del comando
    // que enviamos a la PTY).
    //  - \x1b]LXP-TUI-READY\x07  → marker explícito justo antes de exec opencode.
    //  - \x1b[?1049h             → buffer alterno (opencode/codex/claude TUIs).
    if (s.bootstrapBuffer.includes("\x1b]LXP-TUI-READY\x07") || s.bootstrapBuffer.includes("\x1b[?1049h")) {
      revealSession(tabId);
      return;
    }
    if (s.bootstrapBuffer.includes("instalando en background")) {
      setLoadingDetail(I18N.loading.installingBackground);
    } else if (s.bootstrapBuffer.includes("esperando instalación")) {
      setLoadingDetail(I18N.loading.waitingInstall);
    } else if (s.bootstrapBuffer.includes("instalación terminó con error")) {
      setLoadingDetail(I18N.loading.installFailed);
    } else if (s.bootstrapBuffer.includes("INSTALLER_MISSING")) {
      setLoadingDetail(I18N.loading.installerMissing);
    }
  }

  async function connectWs(tabId: number): Promise<void> {
    let session = sessions.get(tabId);
    if (!session || session.connecting) return;
    session.connecting = true;
    // Nueva conexión (inicial o reconexión): la sesión vuelve a estar "deseada
    // conectada" y sin sondeo de liveness pendiente.
    session.endedNormally = false;
    session.awaitingPong = false;
    const { term } = session;

    // Standalone: same-origin WS, no LP gateway. See `lib/assistant-ws.ts` —
    // the old managed routing hijacked every panel whose own hostname ended in
    // `.luxipanel.com` and sent its terminal WS to `api.luxisoft.com`, which
    // answers 401 now that the bridge is retired.
    const isNginxMode = !location.port || location.port === "80" || location.port === "443";
    const wsPort = (window as any).__BACKEND_PORT__ ?? DEFAULT_BACKEND_PORT;
    const directProto = location.protocol === "https:" ? "wss:" : "ws:";
    // Prefers the session cookie, falls back to /api/auth/ws-token (the cookie
    // is httpOnly, so the direct-path `getToken()` returned empty).
    const token = await getWebsocketToken();
    if (sessions.get(tabId) !== session) return;
    // Id estable por pestaña para reattach. Se conserva entre reconexiones del
    // mismo `session` Y se persiste en localStorage por `tabId`: así sobrevive a
    // una RECARGA de la página (p. ej. el SO recicla el proceso del WebView móvil
    // y se remonta). La pestaña por defecto se recrea con el mismo `tabId` (1),
    // así que recupera su sessionId y el backend re-adjunta la misma sesión tmux.
    if (!session.persistentSessionId) {
      // A display-mode change must not abandon an existing persistent session.
      const startupKey = session.startupCommand === "codex --no-alt-screen" ? "codex" : session.startupCommand;
      const storeKey = `lxp:term:sid:${encodeURIComponent(session.targetScope)}:${startupKey || "default"}:${tabId}`;
      session.sessionStorageKey = storeKey;
      let restored = "";
      try { restored = (localStorage.getItem(storeKey) ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64); } catch { /* ignore */ }
      session.persistentSessionId = restored.length >= 8
        ? restored
        : ((typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
            ? crypto.randomUUID()
            : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
      try { localStorage.setItem(storeKey, session.persistentSessionId); } catch { /* ignore */ }
    }
    const qs = new URLSearchParams();
    if (token) qs.set("token", token);
    qs.set("sessionId", session.persistentSessionId);
    qs.set("autostart", "client");
    // Aislamiento de sesión por pestaña: el backend resuelve el target del WS
    // desde este id (query "bridge") en vez de la cookie compartida por host.
    let tabBridge = "";
    try { tabBridge = (sessionStorage.getItem(BRIDGE_SESSION_SESSION_KEY) || "").trim(); } catch { /* ignore */ }
    if (!tabBridge) {
      tabBridge = (document.getElementById(SERVER_SWITCHER_ID)?.getAttribute(ATTR_CURRENT_BRIDGE_SESSION_ID) || "").trim();
    }
    if (tabBridge) qs.set("bridge", tabBridge);
    const tokenParam = qs.toString() ? `?${qs.toString()}` : "";
    const wsAuthority = isNginxMode ? location.host : `${location.hostname}:${wsPort}`;
    const wsUrl = `${directProto}//${wsAuthority}/api/terminal/ws${tokenParam}`;

    const ws = new WebSocket(wsUrl);
    session.ws = ws;
    session.connecting = false;

    ws.onopen = () => {
      const s = sessions.get(tabId);
      if (s?.ws !== ws) { ws.close(); return; }
      if (s) { s.reconnectAttempts = 0; if (s.reconnectTimer) { clearTimeout(s.reconnectTimer); s.reconnectTimer = null; } }
      if (tabId === S.activeTabId) setStatus(I18N.status.connected, true);
      const { term: t, fitAddon } = session;
      fitAddon.fit();
      ws.send(JSON.stringify({ type: TerminalWsMsg.RESIZE, cols: t.cols, rows: t.rows }));
    };

    ws.onmessage = (e) => {
      if (sessions.get(tabId)?.ws !== ws) return;
      // Cualquier mensaje del backend prueba que el socket sigue vivo: cancela
      // un sondeo de liveness en curso (ver `handleWake`).
      const sLive = sessions.get(tabId);
      if (sLive) sLive.awaitingPong = false;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "output") {
          maybeRevealOnOutput(tabId, msg.data);
          term.write(msg.data);
          const current = sessions.get(tabId);
          if (current) {
            const tracked = trackAlternateScreenExit(current.outputTail ?? "", msg.data);
            current.outputTail = tracked.tail;
            if (tracked.exited) term.write(MOUSE_TRACKING_OFF);
          }
        }
        if (msg.type === "connected") {
          const s = sessions.get(tabId);
          // Re-adjunte de una sesión tmux existente: ya tiene su estado (cwd,
          // proceso/TUI en curso). NO re-hacer `cd` ni re-lanzar el comando de
          // modo (corromperían el TUI). Solo banner distinto + refit.
          const reattached = msg.reattached === true;
          if (!s?.suppressConnectedBanner) {
            term.write(`\x1b[32m${reattached ? I18N.banner.sessionRecovered : I18N.banner.sessionConnected}\x1b[0m\r\n`);
          }
          if (tabId === S.activeTabId) setStatus(tI18n(I18N.status.connectedWithPid, { pid: msg.pid }), true);
          if (reattached) {
            if (s) { s.cdOnConnect = null; s.initialCommand = null; revealSession(tabId); }
            if (s && tabId === S.activeTabId) {
              requestAnimationFrame(() => {
                try { s.fitAddon.fit(); } catch { /* ignore */ }
                try { s.term.focus(); } catch { /* ignore */ }
                if (s.ws?.readyState === WebSocket.OPEN) {
                  s.ws.send(JSON.stringify({ type: TerminalWsMsg.RESIZE, cols: s.term.cols, rows: s.term.rows }));
                }
              });
            }
            return;
          }
          // cd to files path on first connection of a new tab
        if (s?.cdOnConnect) {
          ws.send(JSON.stringify({ type: TerminalWsMsg.INPUT, data: `cd ${JSON.stringify(s.cdOnConnect)}\r` }));
          s.cwd = normalizePath(s.cdOnConnect);
          emitTerminalCwd(s.cwd);
          s.cdOnConnect = null;
        }
          if (s?.initialCommand) {
            ws.send(JSON.stringify({ type: TerminalWsMsg.INPUT, data: `${s.initialCommand}\r` }));
            s.initialCommand = null;
          } else if (s && tabId === S.activeTabId) {
            // Bash normal sin TUI: revealSession() no se va a llamar nunca,
            // así que forzamos aquí un refit + focus + resize-WS para que
            // xterm tenga las dimensiones correctas (el drawer suele estar
            // a media animación cuando se ejecuta el fit inicial) y el cursor
            // empiece enfocado.
            requestAnimationFrame(() => {
              try { s.fitAddon.fit(); } catch { /* ignore */ }
              try { s.term.focus(); } catch { /* ignore */ }
              if (s.ws?.readyState === WebSocket.OPEN) {
                // El resize dispara SIGWINCH en el shell remoto, y readline
                // REPINTA el prompt actual en su sitio (sin newline) si llegó
                // antes de que xterm estuviera listo. NO enviar un Enter "vacío"
                // aquí: bash lo ejecutaría como comando vacío y dibujaría un
                // SEGUNDO prompt (doble prompt al conectar).
                s.ws.send(JSON.stringify({ type: TerminalWsMsg.RESIZE, cols: s.term.cols, rows: s.term.rows }));
              }
            });
          }
        }
        if (msg.type === "exit") {
          if (!msg.reason || terminalProcessEnded(msg.reason)) {
            const current = sessions.get(tabId);
            if (current) current.endedNormally = true;
            term.write(`\r\n\x1b[33m${tI18n(I18N.banner.sessionExited, { code: msg.code })}\x1b[0m\r\n`);
            if (tabId === S.activeTabId) setStatus(I18N.status.sessionEnded, false);
          }
        }
        if (msg.type === "error") {
          term.write(`\r\n\x1b[31m${tI18n(I18N.banner.errorPrefix, { message: msg.message })}\x1b[0m\r\n`);
          if (tabId === S.activeTabId) setStatus(I18N.status.error, false);
        }
        if (msg.type === "pong") {
          // keepalive — noop
        }
      } catch { /* noop */ }
    };

    ws.onerror = () => {
      term.write(`\r\n\x1b[31m${tI18n(I18N.banner.wsError, { url: wsUrl })}\x1b[0m\r\n`);
      term.write(`\x1b[33m${I18N.banner.wsErrorHint}\x1b[0m\r\n`);
      if (tabId === S.activeTabId) setStatus(I18N.status.connectionError, false);
    };

    ws.onclose = (ev) => {
      const s = sessions.get(tabId);
      if (!s || s.ws !== ws) return;
      term.write(MOUSE_TRACKING_OFF);
      // A normal close code can also mean the backend expired or replaced the
      // transport. Only a real PTY process exit should end this terminal tab.
      const processEnded = s.endedNormally || terminalProcessEnded(ev.reason);
      const shouldReconnect = !processEnded && s.reconnectAttempts < 8;
      if (shouldReconnect) {
        const delay = Math.min(1500 * (s.reconnectAttempts + 1), 15_000);
        s.reconnectAttempts++;
        s.cdOnConnect = s.cwd || (window as any).__filesCurrentPath || sessionStorage.getItem(FILES_CURRENT_PATH_KEY) || "/";
        s.initialCommand = s.initialCommand || s.startupCommand;
        if (s.reconnectAttempts === 1) {
          term.write(`\r\n\x1b[33m${I18N.banner.interrupted}\x1b[0m\r\n`);
        } else {
          term.write(`\r\n\x1b[33m${tI18n(I18N.banner.retry, { attempt: s.reconnectAttempts, delay: Math.round(delay / 1000) })}\x1b[0m\r\n`);
        }
        if (tabId === S.activeTabId) setStatus(I18N.status.reconnecting, false);
        s.reconnectTimer = setTimeout(() => { if (sessions.has(tabId)) connectWs(tabId); }, delay);
      } else {
        // Cierre normal (1000 = el PTY salió: `exit`, fin de CLI, o cierre del
        // backend): la sesión tmux ya no existe → NO revivir en la reactivación
        // por cambio de app. Un agotamiento de reintentos (≥8) NO es normal:
        // dejar `endedNormally` en false para que el wake-handler pueda reintentar.
        if (processEnded) s.endedNormally = true;
        if (ev.code !== 1000 && ev.code !== 1001) {
          const closedMsg = ev.reason
            ? tI18n(I18N.banner.connectionClosedWithReason, { code: ev.code, reason: ev.reason })
            : tI18n(I18N.banner.connectionClosed, { code: ev.code });
          term.write(`\r\n\x1b[33m${closedMsg}\x1b[0m\r\n`);
        }
        if (tabId === S.activeTabId) setStatus(I18N.status.disconnected, false);
      }
    };

    // SPA / lifecycle leak guard. Track the handle so we can clear it on
    // EVERY exit path (component teardown, navigation, ws.onclose), not
    // only when readyState !== OPEN. The `else` branch above only ran when
    // the polyfill called the `else` exactly during a readyState check,
    // so a close-during-check or a SPA swap between frames leaked a
    // ping every 30s into the void.
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    const stopPing = () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
    };
    pingTimer = setInterval(() => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: TerminalWsMsg.PING }));
        } else {
          stopPing();
        }
      } catch {
        stopPing();
      }
    }, 30_000);
    ws.addEventListener("close", stopPing, { once: true });
    ws.addEventListener("error", stopPing, { once: true });
  }

  // ── Resize observer ────────────────────────────────────────
  const ro = new ResizeObserver(() => {
    const session = sessions.get(S.activeTabId);
    if (!session) return;
    session.fitAddon.fit();
    if (session.ws?.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify({ type: TerminalWsMsg.RESIZE, cols: session.term.cols, rows: session.term.rows }));
    }
  });

export { createTerminal, getModeInitialCommand, syncLoadingOverlay, connectWs, ro };
