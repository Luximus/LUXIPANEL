// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Terminal interactivo 100% NATIVO (emulador real, sin WebView; motor VT headless).
 *
 * Reemplazo directo del antiguo `ServerTerminalView` (WebView, ya eliminado), pero el
 * núcleo es `TerminalEmulator` (TS puro) pintado por `NativeTerminalView`:
 *  - autoriza y abre `/api/terminal/ws` DIRECTO en LUXIPANEL (helper
 *    `buildTerminalWsUrl`, token WS de corta duración); recibe salida JSON del
 *    PTY y envía entrada/resize/ping como JSON;
 *  - decodifica UTF-8 en streaming (tolera multibyte partido entre frames) y se
 *    lo pasa a `emulator.write` (que a su vez tolera escapes partidos);
 *  - captura el teclado con un `TextInput` oculto (truco del centinela para que
 *    el Backspace siempre tenga algo que borrar) y una barra de teclas especiales
 *    NATIVA (Esc/Tab/Ctrl/Alt/flechas/…), equivalente a la del antiguo terminal WebView (xterm);
 *  - mantiene el preflight de tmux, el keepalive ping/pong, la reconexión
 *    automática, el título, el historial de comandos y la inyección de snippets
 *    (`onRegisterInjector`, parseando el JS `lxp-terminal:inject-command`).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  AppState,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Download, RefreshCw } from "lucide-react-native";
import {
  buildTerminalWsUrl,
  getTerminalTmuxStatus,
  installTerminalTmux,
  type TerminalTmuxStatus,
} from "../api/client";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { terminalKey, terminalPaste } from "../lib/terminal-input";
import { TerminalEmulator } from "../lib/terminal-emulator";
import { NativeTerminalView, type TerminalMetrics } from "./NativeTerminalView";
import { getDirectSessionRevision, subscribeDirectSessions } from "../api/serverApi";
import { ensureTerminalSession } from "../api/terminalSession";
import { useTerminalKeyboard } from "../hooks/useTerminalKeyboard";

export type TerminalStatus = "connecting" | "ready" | "exited" | "error";
type Status = TerminalStatus;
export type TerminalViewport = { bottom: number; height: number };
export type TerminalActions = { reconnect: () => void; blur: () => void };

interface TermStrings {
  reconnect: string;
  disconnected: string;
  connectRequired: string;
  savedConnectionFailed: string;
  connecting: string;
  reconnecting: string;
  tmuxChecking: string;
  tmuxTitle: string;
  tmuxBody: string;
  tmuxInstall: string;
  tmuxInstalling: string;
  tmuxSkip: string;
  tmuxCantInstall: string;
  servers: string;
  keyEsc: string;
  keyTab: string;
  keyCtrl: string;
  keyAlt: string;
}

const STR: Record<string, TermStrings> = {
  es: {
    reconnect: "Reconectar",
    disconnected: "Terminal desconectado",
    connectRequired: "Conecta el servidor para abrir la terminal.",
    savedConnectionFailed: "No se pudo conectar con las credenciales guardadas. Pulsa Reconectar para reintentar.",
    connecting: "Conectando…",
    reconnecting: "Reconectando…",
    tmuxChecking: "Comprobando el servidor…",
    tmuxTitle: "tmux no está instalado",
    tmuxBody:
      "El terminal usa tmux para que tu sesión sobreviva si cambias de app o se corta la conexión. Sin tmux, cada reconexión abre una sesión nueva.",
    tmuxInstall: "Instalar tmux",
    tmuxInstalling: "Instalando tmux…",
    tmuxSkip: "Abrir sin persistencia",
    tmuxCantInstall:
      "No se puede instalar automáticamente en este servidor; instálalo manualmente o pídelo a tu proveedor.",
    servers: "Servidores",
    keyEsc: "Esc",
    keyTab: "Tab",
    keyCtrl: "Ctrl",
    keyAlt: "Alt",
  },
  en: {
    reconnect: "Reconnect",
    disconnected: "Terminal disconnected",
    connectRequired: "Connect the server to open the terminal.",
    savedConnectionFailed: "Could not connect using the saved credentials. Tap Reconnect to retry.",
    connecting: "Connecting…",
    reconnecting: "Reconnecting…",
    tmuxChecking: "Checking the server…",
    tmuxTitle: "tmux is not installed",
    tmuxBody:
      "The terminal uses tmux so your session survives switching apps or a dropped connection. Without tmux, each reconnect starts a new session.",
    tmuxInstall: "Install tmux",
    tmuxInstalling: "Installing tmux…",
    tmuxSkip: "Open without persistence",
    tmuxCantInstall: "Can't auto-install on this server; install it manually or ask your provider.",
    servers: "Servers",
    keyEsc: "Esc",
    keyTab: "Tab",
    keyCtrl: "Ctrl",
    keyAlt: "Alt",
  },
};

function strings(language?: string): TermStrings {
  return STR[(language ?? "es").slice(0, 2)] ?? STR.es;
}

// Métrica inicial hasta que onTextLayout mida la fuente (fallback: monospace ≈ 0.6·fontSize).
const H_PADDING = 6;
const V_PADDING = 4;

const MAX_AUTO_RECONNECT = 6;
// Centinela invisible: el `TextInput` siempre contiene 1 carácter para que el
// Backspace dispare un cambio (borrarlo) aunque el "valor real" esté vacío.
const SENTINEL = "​";

/** Decodificador UTF-8 incremental: bufferiza bytes multibyte partidos entre frames. */
class Utf8StreamDecoder {
  private pending: number[] = [];

  decode(bytes: Uint8Array): string {
    let out = "";
    const buf = this.pending.length ? [...this.pending, ...Array.from(bytes)] : Array.from(bytes);
    this.pending = [];
    let i = 0;
    while (i < buf.length) {
      const b = buf[i];
      let cp = 0;
      let needed = 0;
      if (b < 0x80) {
        out += String.fromCharCode(b);
        i++;
        continue;
      } else if ((b & 0xe0) === 0xc0) {
        cp = b & 0x1f;
        needed = 1;
      } else if ((b & 0xf0) === 0xe0) {
        cp = b & 0x0f;
        needed = 2;
      } else if ((b & 0xf8) === 0xf0) {
        cp = b & 0x07;
        needed = 3;
      } else {
        // Byte inválido: emitir reemplazo y avanzar.
        out += "�";
        i++;
        continue;
      }
      if (i + needed >= buf.length) {
        // Secuencia incompleta al final: guardar para el próximo frame.
        this.pending = buf.slice(i);
        break;
      }
      let ok = true;
      for (let k = 1; k <= needed; k++) {
        const cont = buf[i + k];
        if ((cont & 0xc0) !== 0x80) {
          ok = false;
          break;
        }
        cp = (cp << 6) | (cont & 0x3f);
      }
      if (!ok) {
        out += "�";
        i++;
        continue;
      }
      if (cp > 0xffff) {
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      } else {
        out += String.fromCharCode(cp);
      }
      i += needed + 1;
    }
    return out;
  }
}

/** Extrae `command`/`run` del JS de snippet (`lxp-terminal:inject-command`). */
function parseInjectedCommand(js: string): { command: string; run: boolean } | null {
  try {
    const cmdMatch = js.match(/command:("(?:[^"\\]|\\.)*")/);
    if (!cmdMatch) return null;
    const command = JSON.parse(cmdMatch[1]) as string;
    const run = /run:\s*true/.test(js);
    return { command, run };
  } catch {
    return null;
  }
}

/**
 * Terminal nativo: réplica exacta del contrato del antiguo `ServerTerminalView` pero con
 * motor VT headless. Props idénticas para ser intercambiable en `MainScreen`.
 */
export default function NativeTerminalSession({
  panelId,
  token,
  language,
  fontSize = 13,
  onRegisterInjector,
  topTabs,
  onSelectTopTab,
  onCommand,
  sessionId,
  active = true,
  onViewportChange,
  onStatusChange,
  onRegisterActions,
}: {
  panelId: string;
  token: string;
  language?: string;
  fontSize?: number;
  sessionId?: string;
  /** Hidden consoles retain their PTY, but must never take keyboard focus. */
  active?: boolean;
  onViewportChange?: (viewport: TerminalViewport) => void;
  onStatusChange?: (status: TerminalStatus) => void;
  onRegisterActions?: (actions: TerminalActions) => void;
  onRegisterInjector?: (inject: (js: string) => void) => void;
  /** Tabs del drawer del servidor (Terminal / Chat / Ajustes) pintados ARRIBA del
   *  terminal — reemplazan las asas flotantes `</>` y "Servidores". Tocar uno abre
   *  el drawer en ese tab. "Terminal" (snippets) queda resaltado como contexto. */
  topTabs?: { key: string; label: string; accent?: boolean }[];
  onSelectTopTab?: (key: string) => void;
  onCommand?: (command: string, injected: boolean) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const tokens = getThemeTokens(isDark);
  const insets = useSafeAreaInsets();
  const t = strings(language);
  const sessionRevision = useSyncExternalStore(subscribeDirectSessions, () => getDirectSessionRevision(panelId));

  // Botón atrás de Android: NO se registra aquí. Desde B2 la sesión vive
  // SIEMPRE montada en el `SessionHost` global (incluso minimizada, suprimida
  // o en una pestaña inactiva), así que un BackHandler propio —registrado
  // después que el del MainTab y por tanto con prioridad— consumía TODOS los
  // "atrás" en cuanto existiera cualquier consola, aunque no estuviera visible.
  // El único punto de verdad es el BackHandler del MainTab activo en
  // `MainScreen` (caso `consoleOverlayVisible` → `minimizeConsoles`), que ya
  // aplica la prioridad correcta entre overlays.

  // ── Emulador + render tick ──────────────────────────────────────────────────
  const emulatorRef = useRef<TerminalEmulator | null>(null);
  if (!emulatorRef.current) emulatorRef.current = new TerminalEmulator(80, 24);
  const decoderRef = useRef(new Utf8StreamDecoder());
  // `tick` fuerza el re-render; se coalesce con un timer para no repintar por byte.
  const [, setTick] = useState(0);
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRender = useCallback(() => {
    if (renderTimer.current) return;
    renderTimer.current = setTimeout(() => {
      renderTimer.current = null;
      setTick((n) => (n + 1) & 0xffff);
    }, 16);
  }, []);

  // ── Tamaño de la grilla (de la métrica de fuente + área disponible) ─────────
  const [grid, setGrid] = useState<{ cols: number; rows: number }>({ cols: 80, rows: 24 });
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const [metrics, setMetrics] = useState<TerminalMetrics>({ cellWidth: fontSize * 0.6, cellHeight: fontSize + 5, fontSize, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" });
  useEffect(() => {
    setMetrics((prev) => prev.fontSize === fontSize ? prev : { ...prev, fontSize, cellHeight: fontSize + 5, cellWidth: fontSize * 0.6 });
  }, [fontSize]);
  const { surfaceRef, onSurfaceLayout, keyboardOpen, overlap } = useTerminalKeyboard(insets.top);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [keysHeight, setKeysHeight] = useState(87);
  const [scrollOffset, setScrollOffset] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setArea({ width, height });
  }, []);
  useEffect(() => {
    if (!area.width || !area.height) return;
    const cols = Math.max(2, Math.floor((area.width - H_PADDING * 2) / metrics.cellWidth));
    const rows = Math.max(2, Math.floor((area.height - V_PADDING * 2) / metrics.cellHeight));
    setGrid(prev => prev.cols === cols && prev.rows === rows ? prev : { cols, rows });
  }, [area, metrics]);

  // ── Conexión / estado ───────────────────────────────────────────────────────
  const [status, setStatus] = useState<Status>("connecting");
  const [reloadKey, setReloadKey] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [gate, setGate] = useState<"checking" | "ok" | "needs-install" | "auth-error">("checking");
  const [gateStatus, setGateStatus] = useState<TerminalTmuxStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const callbacks = useRef({ onViewportChange, onStatusChange, onRegisterActions });
  callbacks.current = { onViewportChange, onStatusChange, onRegisterActions };
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => { callbacks.current.onStatusChange?.(status); }, [status]);
  const keysVisible = active && gate === "ok" && keyboardOpen;
  useEffect(() => {
    if (active) callbacks.current.onViewportChange?.({
      bottom: overlap + (keysVisible ? keysHeight : 0),
      height: area.height,
    });
  }, [active, overlap, keysVisible, keysHeight, insets.bottom, area.height]);

  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<Status>("connecting");
  statusRef.current = status;
  const attemptsRef = useRef(0);
  const appActiveRef = useRef(true);
  const lastCloseCodeRef = useRef<number | undefined>(undefined);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Modificadores pegajosos (Ctrl/Alt) ──────────────────────────────────────
  const [stickyCtrl, setStickyCtrl] = useState(false);
  const [stickyAlt, setStickyAlt] = useState(false);
  const stickyCtrlRef = useRef(false);
  const stickyAltRef = useRef(false);
  stickyCtrlRef.current = stickyCtrl;
  stickyAltRef.current = stickyAlt;

  // ── Captura de comandos tecleados (historial + auto-rótulo) ─────────────────
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  const lineBufRef = useRef("");
  const captureInput = useCallback((data: string) => {
    let buf = lineBufRef.current;
    for (let i = 0; i < data.length; i++) {
      const code = data.charCodeAt(i);
      if (code === 13 || code === 10) {
        const c = buf.trim();
        if (c) onCommandRef.current?.(c, false);
        buf = "";
      } else if (code === 127 || code === 8) {
        buf = buf.slice(0, -1);
      } else if (code === 27) {
        break; // ESC: ignora la secuencia
      } else if (code === 3 || code === 21) {
        buf = ""; // Ctrl-C / Ctrl-U
      } else if (code >= 32) {
        buf += data[i];
      }
    }
    lineBufRef.current = buf;
  }, []);

  // ── Envío de entrada al PTY ──────────────────────────────────────────────────
  const sendRaw = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "input", data }));
      } catch {
        /* socket cerrándose */
      }
    }
  }, []);

  emulatorRef.current.onData = sendRaw;
  emulatorRef.current.onChange = scheduleRender;
  useEffect(() => () => {
    if (renderTimer.current) clearTimeout(renderTimer.current);
    emulatorRef.current?.dispose();
  }, []);

  // Aplica Ctrl/Alt pegajosos a un texto de 1 carácter imprimible (igual que la webview).
  const applyMods = useCallback((text: string): string => {
    if (!stickyCtrlRef.current && !stickyAltRef.current) return text;
    if (text.length !== 1 || text.charCodeAt(0) < 32) return text;
    let out = text;
    if (stickyCtrlRef.current) out = String.fromCharCode(out.toUpperCase().charCodeAt(0) & 31);
    if (stickyAltRef.current) out = "\x1b" + out;
    setStickyCtrl(false);
    setStickyAlt(false);
    return out;
  }, []);

  const sendTyped = useCallback(
    (text: string) => {
      const mapped = text.replace(/\n/g, "\r"); // Enter del teclado → CR
      const out = text.length > 1 ? terminalPaste(text, emulatorRef.current!.bracketedPaste) : applyMods(mapped);
      setScrollOffset(0);
      captureInput(text.length > 1 ? mapped : out);
      sendRaw(out);
    },
    [applyMods, captureInput, sendRaw],
  );

  // ── TextInput oculto (centinela) ─────────────────────────────────────────────
  const inputRef = useRef<TextInput | null>(null);
  const [inputValue, setInputValue] = useState(SENTINEL);
  const onChangeText = useCallback(
    (next: string) => {
      if (!activeRef.current) return;
      if (next.startsWith(SENTINEL)) {
        const added = next.slice(SENTINEL.length);
        if (added) sendTyped(added);
      } else if (next.length < SENTINEL.length) {
        // Centinela borrado → Backspace.
        sendRaw("\x7f");
        captureInput("\x7f");
      } else if (next) {
        // El IME reemplazó todo (sin el centinela delante): enviar tal cual.
        sendTyped(next);
      }
      setInputValue(SENTINEL);
    },
    [sendTyped, sendRaw, captureInput],
  );

  // ── Barra de teclas especiales ───────────────────────────────────────────────
  const pressSpecial = useCallback(
    (k: string) => {
      if (k === "ctrl") {
        setStickyCtrl((v) => !v);
        return;
      }
      if (k === "alt") {
        setStickyAlt((v) => !v);
        return;
      }
      if (k === "ctrlc") {
        sendRaw("\x03");
        captureInput("\x03");
        return;
      }
      const seq = terminalKey(k, emulatorRef.current!.applicationCursor, stickyCtrlRef.current, stickyAltRef.current);
      if (!seq) return;
      sendRaw(seq);
      setStickyCtrl(false);
      setStickyAlt(false);
    },
    [sendRaw, captureInput],
  );

  // ── Snippet injector (parsea el JS de `lxp-terminal:inject-command`) ─────────
  const onRegisterInjectorRef = useRef(onRegisterInjector);
  onRegisterInjectorRef.current = onRegisterInjector;
  useEffect(() => {
    const inject = (js: string) => {
      const parsed = parseInjectedCommand(js);
      if (!parsed) return;
      sendRaw(parsed.command + (parsed.run ? "\r" : ""));
      if (parsed.run) {
        const ic = parsed.command.trim();
        if (ic) onCommandRef.current?.(ic, true); // inyectado: no va al historial, sí al rótulo
      }
    };
    onRegisterInjectorRef.current?.(inject);
    return () => onRegisterInjectorRef.current?.(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendRaw]);

  // ── Reconexión ───────────────────────────────────────────────────────────────
  const clearReconnectTimer = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };
  const doReconnect = useCallback(() => {
    clearReconnectTimer();
    setExhausted(false);
    setStatus("connecting");
    setGate("checking");
    setReloadKey((k) => k + 1);
  }, []);
  const reconnect = useCallback(() => {
    attemptsRef.current = 0;
    doReconnect();
  }, [doReconnect]);
  useEffect(() => {
    callbacks.current.onRegisterActions?.({ reconnect, blur: () => inputRef.current?.blur() });
  }, [reconnect]);
  useEffect(() => {
    if (!active) {
      inputRef.current?.blur();
      setStickyCtrl(false);
      setStickyAlt(false);
    }
  }, [active]);

  // ── Preflight tmux ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setGate("checking");
    setInstallError(null);
    void (async () => {
      const connected = await ensureTerminalSession(panelId, token, () => !cancelled);
      if (cancelled) return;
      if (!connected) {
        lastCloseCodeRef.current = 1008;
        setConnectionError(t.savedConnectionFailed);
        setExhausted(true);
        setStatus("error");
        setGate("auth-error");
        return;
      }
      const st = await getTerminalTmuxStatus(panelId, token);
      if (cancelled) return;
      setGateStatus(st);
      setGate(st.installed ? "ok" : "needs-install");
    })();
    return () => {
      cancelled = true;
    };
  }, [panelId, token, sessionRevision, reloadKey]);

  const onInstallTmux = useCallback(async () => {
    setInstalling(true);
    setInstallError(null);
    const res = await installTerminalTmux(panelId, token);
    setInstalling(false);
    if (res.installed) {
      setGate("ok");
      return;
    }
    setInstallError(res.error ?? "No se pudo instalar tmux.");
  }, [panelId, token]);
  const onSkipTmux = useCallback(() => setGate("ok"), []);

  // ── WebSocket: una conexión por `reloadKey` (con gate ok) ───────────────────
  useEffect(() => {
    if (gate !== "ok") return;
    const size = gridRef.current;
    // Sincroniza el emulador con el tamaño actual antes de conectar.
    emulatorRef.current?.resize(size.cols, size.rows);
    let disposed = false;
    let ws: WebSocket | undefined;
    let handshakeTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus("connecting");
    setConnectionError(null);

    const stopPing = () => {
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
    };

    void (async () => {
      try {
        const url = await buildTerminalWsUrl(panelId, token, size, sessionId);
        if (disposed) return;
        ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;
        handshakeTimer = setTimeout(() => { if (!disposed) { setConnectionError(language?.startsWith("en") ? "Terminal connection timed out." : "La conexión con la terminal tardó demasiado."); setStatus("error"); ws?.close(); } }, 20000);

        ws.onopen = () => {
          if (disposed) return;
          lastCloseCodeRef.current = undefined;
          // Resize inicial explícito (por si el query no bastó) + keepalive.
          try {
            ws?.send(JSON.stringify({ type: "resize", cols: gridRef.current.cols, rows: gridRef.current.rows }));
          } catch {
            /* ignore */
          }
          stopPing();
          pingTimer.current = setInterval(() => {
            try {
              if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
            } catch {
              /* ignore */
            }
          }, 20000);
        };

        ws.onmessage = (ev: WebSocketMessageEvent) => {
          if (disposed) return;
          const data = ev.data as unknown;
          if (typeof data === "string") {
            // LUXIPANEL envía la salida del PTY dentro de {type:"output",data}.
            try {
              const ctl = JSON.parse(data);
              if (ctl && ctl.type) {
                if (ctl.type === "output" && typeof ctl.data === "string") {
                  emulatorRef.current?.write(ctl.data);
                } else if (ctl.type === "connected") {
                  if (handshakeTimer) clearTimeout(handshakeTimer);
                  // The backend installs its message listener after auth/PTY
                  // creation. The onopen resize can be lost during that work;
                  // query cols/rows are not consumed by the backend. Match the
                  // browser's post-connected resize, also on tmux reattachment.
                  const currentSize = gridRef.current;
                  ws?.send(JSON.stringify({ type: "resize", cols: currentSize.cols, rows: currentSize.rows }));
                  setStatus("ready");
                } else if (ctl.type === "error") {
                  setConnectionError(typeof ctl.message === "string" ? ctl.message : null);
                } else if (ctl.type === "exit") {
                  setStatus("exited");
                }
                return;
              }
            } catch {
              /* no era JSON → tratar como texto del PTY */
            }
            emulatorRef.current?.write(data);
            return;
          }
          try {
            const bytes = new Uint8Array(data as ArrayBuffer);
            const text = decoderRef.current.decode(bytes);
            if (text) {
              emulatorRef.current?.write(text);
              }
          } catch {
            /* frame ilegible: ignorar */
          }
        };

        ws.onclose = (ev: WebSocketCloseEvent) => {
          if (disposed) return;
          stopPing();
          if (handshakeTimer) clearTimeout(handshakeTimer);
          lastCloseCodeRef.current = ev.code;
          if (wsRef.current === ws) wsRef.current = null;
          setStatus("exited");
        };
        ws.onerror = () => {
          if (disposed) return;
          setStatus("error");
        };
      } catch (cause) {
        if (disposed) return;
        const needsLogin = cause instanceof Error && ["connect_required", "auth_required"].includes(cause.message);
        lastCloseCodeRef.current = needsLogin ? 1008 : undefined;
        setConnectionError(needsLogin ? t.connectRequired : null);
        setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      if (handshakeTimer) clearTimeout(handshakeTimer);
      stopPing();
      try {
        if (ws) {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onclose = null;
          ws.onerror = null;
          ws.close();
        }
      } catch {
        /* ignore */
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, reloadKey, panelId, token, sessionId, sessionRevision]);

  // ── Resize en caliente: avisar al emulador + al PTY sin reconectar ──────────
  useEffect(() => {
    emulatorRef.current?.resize(grid.cols, grid.rows);
    scheduleRender();
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "resize", cols: grid.cols, rows: grid.rows }));
      } catch {
        /* ignore */
      }
    }
  }, [grid.cols, grid.rows, scheduleRender]);

  // ── Reconexión automática (mismo criterio que la webview) ────────────────────
  useEffect(() => {
    if (status === "ready") {
      attemptsRef.current = 0;
      setExhausted(false);
      return;
    }
    if (status !== "exited" && status !== "error") return;
    if (!appActiveRef.current) return;
    if (lastCloseCodeRef.current === 1008) {
      setExhausted(true);
      return;
    }
    if (attemptsRef.current >= MAX_AUTO_RECONNECT) {
      setExhausted(true);
      return;
    }
    attemptsRef.current += 1;
    clearReconnectTimer();
    reconnectTimer.current = setTimeout(() => {
      doReconnect();
    }, 800);
    return clearReconnectTimer;
  }, [status, doReconnect]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const wasActive = appActiveRef.current;
      appActiveRef.current = next === "active";
      if (next === "active" && !wasActive) {
        attemptsRef.current = 0;
        if (statusRef.current === "exited" || statusRef.current === "error") doReconnect();
      }
    });
    return () => sub.remove();
  }, [doReconnect]);
  useEffect(() => clearReconnectTimer, []);

  // Reabrir el teclado al tocar la pantalla. En Android, tras cerrar el teclado
  // (botón atrás / swipe) el TextInput CONSERVA el foco en el estado de RN, así
  // que un `.focus()` directo es no-op y el teclado no reaparece. El truco
  // blur()→focus() en el siguiente frame fuerza la reapertura aunque siga
  // "enfocado". Si no estaba enfocado, el focus() basta igual.
  const focusInput = useCallback(() => {
    if (!activeRef.current) return;
    const el = inputRef.current;
    if (!el) return;
    try {
      if (el.isFocused?.()) el.blur();
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => {
      if (!activeRef.current) return;
      try {
        inputRef.current?.focus();
      } catch {
        /* ignore */
      }
    });
  }, []);

  // Snapshot del emulador para pintar.
  const emu = emulatorRef.current!;
  const renderOffset = emu.alternateScreen ? 0 : scrollOffset;
  const renderRows = emu.getRenderRows(renderOffset);
  const cursor = { ...emu.getCursor(), visible: renderOffset === 0 && emu.getCursor().visible };

  // ── UI del preflight tmux ────────────────────────────────────────────────────
  function renderGate() {
    if (gate === "checking") {
      return (
        <View style={styles.overlay}>
          <ActivityIndicator color="#a78bfa" />
          <Text style={styles.overlayText}>{t.tmuxChecking}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.overlay, styles.gateCard]}>
        <View style={styles.gateIcon}>
          <AlertTriangle size={26} color="#f59e0b" />
        </View>
        <Text style={styles.gateTitle}>{t.tmuxTitle}</Text>
        <Text style={styles.gateBody}>{t.tmuxBody}</Text>
        {gateStatus?.canInstall ? (
          <Pressable
            onPress={onInstallTmux}
            disabled={installing}
            style={({ pressed }) => [
              styles.installBtn,
              { backgroundColor: tokens.brand, opacity: pressed || installing ? 0.85 : 1 },
            ]}
          >
            {installing ? <ActivityIndicator color="#fff" size="small" /> : <Download size={16} color="#fff" />}
            <Text style={styles.installText}>{installing ? t.tmuxInstalling : t.tmuxInstall}</Text>
          </Pressable>
        ) : (
          <Text style={styles.gateWarn}>{t.tmuxCantInstall}</Text>
        )}
        <Pressable onPress={onSkipTmux} hitSlop={8}>
          <Text style={styles.skipText}>{t.tmuxSkip}</Text>
        </Pressable>
        {installError ? <Text style={styles.errText}>{installError}</Text> : null}
      </View>
    );
  }

  // Same two rows as the current web terminal; Ctrl/Alt apply to the next key.
  const keyRows: { k: string; label: string }[][] = [
    [
      { k: "esc", label: t.keyEsc },
      { k: "tab", label: t.keyTab },
      { k: "ctrl", label: t.keyCtrl },
      { k: "alt", label: t.keyAlt },
      { k: "pgup", label: "PgUp" },
      { k: "pgdn", label: "PgDn" },
      { k: "/", label: "/" },
    ],
    [
      { k: "home", label: "Home" },
      { k: "left", label: "←" },
      { k: "up", label: "↑" },
      { k: "down", label: "↓" },
      { k: "right", label: "→" },
      { k: "end", label: "End" },
    ],
  ];
  const sendKey = (k: string) => {
    if (!activeRef.current) return;
    if (k.length === 1) {
      sendTyped(k);
      return;
    }
    pressSpecial(k);
  };

  const showTerminal = gate === "ok" || gate === "auth-error";

  return (
    <View ref={surfaceRef} collapsable={false} onLayout={onSurfaceLayout} style={[styles.wrap, { backgroundColor: "#0b1220", paddingBottom: overlap }]}>
      <Text allowFontScaling={false} pointerEvents="none" onTextLayout={e => { const width = e.nativeEvent.lines[0]?.width; if (width && e.nativeEvent.lines.length === 1 && Number.isFinite(width)) setMetrics(prev => Math.abs(prev.cellWidth - width / 32) < 0.01 ? prev : { ...prev, cellWidth: width / 32 }); }} style={{ position: "absolute", width: 1000, opacity: 0, fontFamily: metrics.fontFamily, fontSize: metrics.fontSize, lineHeight: metrics.cellHeight, includeFontPadding: false }}>{"M".repeat(32)}</Text>
      {/* Barra de tabs del servidor (Terminal / Chat / Ajustes) FIJA arriba, con
          inset de status-bar. Sustituye a las asas flotantes `</>` y "Servidores":
          tocar un tab abre el drawer en esa sección. "Terminal" queda activo como
          contexto actual. El botón atrás de Android sigue minimizando. */}
      {topTabs && topTabs.length > 0 ? (
        <View style={[styles.topTabsBar, { paddingTop: insets.top + 6 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topTabsRow}>
            {topTabs.map((tab) => {
              const active = tab.key === "snippets";
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => onSelectTopTab?.(tab.key)}
                  style={[
                    styles.topTab,
                    {
                      backgroundColor: active ? tokens.brand : "rgba(148,163,184,0.10)",
                      borderColor: active ? tokens.brand : "rgba(148,163,184,0.28)",
                    },
                  ]}
                >
                  <Text style={[styles.topTabLabel, { color: active ? "#ffffff" : "#cbd5e1" }]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      <Pressable style={styles.termArea} onPress={focusInput} onLayout={onLayout}>
        <View style={[styles.gridHolder, { paddingHorizontal: H_PADDING, paddingVertical: V_PADDING }]}>
          <NativeTerminalView
            rows={renderRows}
            cursor={cursor}
            cols={grid.cols}
            rowCount={grid.rows}
            metrics={metrics}
            isDark
          />
        </View>
        {gate === "checking" || gate === "needs-install" ? renderGate() : null}

        {/* TextInput oculto que captura el teclado (centinela para el Backspace). */}
        {gate === "ok" ? (
          <TextInput
            ref={inputRef}
            value={inputValue}
            onChangeText={onChangeText}
            multiline
            autoFocus={active}
            editable={active}
            blurOnSubmit={false}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            keyboardAppearance="dark"
            caretHidden
            style={styles.hiddenInput}
            underlineColorAndroid="transparent"
          />
        ) : null}

        {gate === "ok" && status === "connecting" ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color="#a78bfa" />
            <Text style={styles.overlayText}>{t.connecting}</Text>
          </View>
        ) : null}
        {gate === "ok" && (status === "exited" || status === "error") && !exhausted ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color="#a78bfa" />
            <Text style={styles.overlayText}>{t.reconnecting}</Text>
          </View>
        ) : null}
        {showTerminal && (status === "exited" || status === "error") && exhausted ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>{t.disconnected}</Text>
            {connectionError ? <Text accessibilityRole="alert" style={styles.errText}>{connectionError}</Text> : null}
            <Pressable onPress={reconnect} style={[styles.reconnectBtn, { backgroundColor: tokens.brand }]}>
              <RefreshCw size={15} color="#fff" />
              <Text style={styles.reconnectText}>{t.reconnect}</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>

      {/* Barra de teclas especiales NATIVA (a diferencia de la webview, aquí los
          overlays nativos SÍ se ven). Solo con el teclado abierto. */}
      {keysVisible ? (
        <View testID="terminal-special-keys" onLayout={(event) => setKeysHeight(event.nativeEvent.layout.height)} style={[styles.keysBar, { backgroundColor: tokens.bgCardSolid, borderTopColor: tokens.border }]}>
          {keyRows.map((row, ri) => (
            <View key={ri} style={styles.keysRow}>
              {row.map((key) => {
                const active = (key.k === "ctrl" && stickyCtrl) || (key.k === "alt" && stickyAlt);
                return (
                  <Pressable
                    key={key.k}
                    accessibilityRole="button"
                    accessibilityLabel={key.label}
                    accessibilityState={{ selected: active }}
                    onPress={() => sendKey(key.k)}
                    style={[
                      styles.keyBtn,
                      { backgroundColor: active ? tokens.brand : tokens.bgCardSolid, borderColor: active ? tokens.brand : tokens.border },
                    ]}
                  >
                    <Text style={[styles.keyLabel, { color: active ? tokens.accentText : tokens.textPrimary }]}>{key.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: "hidden" },
  termArea: { flex: 1, position: "relative" },
  gridHolder: { flex: 1 },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    left: 0,
    top: 0,
    color: "transparent",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(11,18,32,0.6)",
  },
  overlayText: { color: "#e6edf3", fontSize: 13, fontWeight: "600" },
  reconnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  reconnectText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  // Barra de tabs superior (Terminal / Chat / Ajustes) sobre el terminal nativo.
  topTabsBar: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    backgroundColor: "#0b1220",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  topTabsRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  topTab: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topTabLabel: { fontSize: 13, fontWeight: "700" },
  keysBar: {
    flexDirection: "column",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#0b1220",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  keysRow: { flexDirection: "row", gap: 6 },
  keyBtn: {
    flex: 1,
    minWidth: 0,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  keyLabel: { color: "#e5e7eb", fontSize: 11, fontWeight: "600" },
  // Tarjeta de preflight de tmux.
  gateCard: { paddingHorizontal: 28, gap: 14, backgroundColor: "rgba(11,18,32,0.96)" },
  gateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.15)",
  },
  gateTitle: { color: "#f1f5f9", fontSize: 16, fontWeight: "800", textAlign: "center" },
  gateBody: { color: "#94a3b8", fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 360 },
  gateWarn: { color: "#fbbf24", fontSize: 12.5, lineHeight: 18, textAlign: "center", maxWidth: 360 },
  installBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    minWidth: 170,
    justifyContent: "center",
  },
  installText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  skipText: { color: "#94a3b8", fontSize: 12.5, fontWeight: "600", textDecorationLine: "underline" },
  errText: { color: "#f87171", fontSize: 12, textAlign: "center", maxWidth: 360 },
});
