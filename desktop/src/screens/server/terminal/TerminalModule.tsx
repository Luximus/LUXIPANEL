/**
 * TerminalModule (desktop) — TERMINAL SSH nativo de un servidor standalone
 * (conexión DIRECTA). Reemplaza el STUB/webview por un terminal **xterm** que
 * abre un WebSocket DIRECTO al box: `wss://<box>/api/terminal/ws?token=<jwt>`.
 *
 * De dónde salen `baseUrl` + `jwt`: del `DirectTarget` que `serverApi.getDirect`
 * (registro `serverId → DirectTarget`) devuelve para este servidor. `baseUrl`
 * (`https://box`) se convierte a `wss://box` (http→ws, https→wss) y `jwt` (JWT de
 * sesión del panel, cookie `luxipanel_session`) viaja por query `?token=` porque
 * el WS no fija headers de forma fiable. Sin target directo (modo gateway) el
 * terminal directo no aplica → panel de "no disponible".
 *
 * Protocolo del box (ver `LUXIPANEL/backend/src/modules/terminal/README.md`):
 *   cliente→box: {type:"input",data} · {type:"resize",cols,rows} · {type:"ping"}
 *   box→cliente: {type:"output",data} · {type:"connected",…} · {type:"exit",…}
 *                {type:"error",message} · {type:"pong"}
 *
 * xterm + FitAddon montados una vez; re-fit por ResizeObserver (y `resize` al
 * box). Reconexión manual (botón). Chrome (cabecera + refrescar) estilo
 * `MonitorModule` (Tailwind + daisyUI + lucide-react). Al desmontar: dispose del
 * xterm + close del WS.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Terminal as TerminalIcon } from "lucide-react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { getDirect, type DirectTarget } from "../../../api/serverApi";
import { getMessages } from "../../../i18n";
import type { ModuleProps } from "../module-host";
import type { ThemeMode } from "../../../features/app/types";

type Status = "connecting" | "connected" | "disconnected" | "error";

// ── i18n mínimo local (no toca `i18n/messages/index.ts`) ─────────────────────
// Solo las 4-5 cadenas propias del terminal; el resto (refrescar/error) sale de
// `common`. Claves cortas en los 11 idiomas soportados, con fallback a inglés.
type TermKey = "title" | "subtitle" | "connecting" | "connected" | "disconnected" | "connError" | "reconnect" | "unavailable" | "unavailableHint";
const TERM_STRINGS: Record<string, Record<TermKey, string>> = {
  es: { title: "Terminal", subtitle: "Consola SSH del servidor", connecting: "Conectando…", connected: "Conectado", disconnected: "Sesión cerrada", connError: "Error de conexión", reconnect: "Reconectar", unavailable: "Terminal no disponible", unavailableHint: "El terminal nativo requiere una conexión directa al servidor." },
  en: { title: "Terminal", subtitle: "Server SSH console", connecting: "Connecting…", connected: "Connected", disconnected: "Session closed", connError: "Connection error", reconnect: "Reconnect", unavailable: "Terminal unavailable", unavailableHint: "The native terminal requires a direct connection to the server." },
  fr: { title: "Terminal", subtitle: "Console SSH du serveur", connecting: "Connexion…", connected: "Connecté", disconnected: "Session fermée", connError: "Erreur de connexion", reconnect: "Reconnecter", unavailable: "Terminal indisponible", unavailableHint: "Le terminal natif nécessite une connexion directe au serveur." },
  pt: { title: "Terminal", subtitle: "Console SSH do servidor", connecting: "Conectando…", connected: "Conectado", disconnected: "Sessão encerrada", connError: "Erro de conexão", reconnect: "Reconectar", unavailable: "Terminal indisponível", unavailableHint: "O terminal nativo requer uma conexão direta ao servidor." },
  it: { title: "Terminale", subtitle: "Console SSH del server", connecting: "Connessione…", connected: "Connesso", disconnected: "Sessione chiusa", connError: "Errore di connessione", reconnect: "Riconnetti", unavailable: "Terminale non disponibile", unavailableHint: "Il terminale nativo richiede una connessione diretta al server." },
  ru: { title: "Терминал", subtitle: "SSH-консоль сервера", connecting: "Подключение…", connected: "Подключено", disconnected: "Сессия закрыта", connError: "Ошибка подключения", reconnect: "Переподключить", unavailable: "Терминал недоступен", unavailableHint: "Нативному терминалу нужно прямое подключение к серверу." },
  zh: { title: "终端", subtitle: "服务器 SSH 控制台", connecting: "正在连接…", connected: "已连接", disconnected: "会话已关闭", connError: "连接错误", reconnect: "重新连接", unavailable: "终端不可用", unavailableHint: "原生终端需要直接连接到服务器。" },
  ko: { title: "터미널", subtitle: "서버 SSH 콘솔", connecting: "연결 중…", connected: "연결됨", disconnected: "세션 종료됨", connError: "연결 오류", reconnect: "다시 연결", unavailable: "터미널을 사용할 수 없음", unavailableHint: "네이티브 터미널은 서버에 직접 연결해야 합니다." },
  ja: { title: "ターミナル", subtitle: "サーバー SSH コンソール", connecting: "接続中…", connected: "接続済み", disconnected: "セッション終了", connError: "接続エラー", reconnect: "再接続", unavailable: "ターミナルを利用できません", unavailableHint: "ネイティブターミナルはサーバーへの直接接続が必要です。" },
  hi: { title: "टर्मिनल", subtitle: "सर्वर SSH कंसोल", connecting: "कनेक्ट हो रहा है…", connected: "कनेक्टेड", disconnected: "सत्र बंद", connError: "कनेक्शन त्रुटि", reconnect: "पुनः कनेक्ट करें", unavailable: "टर्मिनल अनुपलब्ध", unavailableHint: "नेटिव टर्मिनल के लिए सर्वर से सीधा कनेक्शन आवश्यक है।" },
  ar: { title: "الطرفية", subtitle: "وحدة تحكم SSH للخادم", connecting: "جارٍ الاتصال…", connected: "متصل", disconnected: "أُغلقت الجلسة", connError: "خطأ في الاتصال", reconnect: "إعادة الاتصال", unavailable: "الطرفية غير متاحة", unavailableHint: "تتطلب الطرفية الأصلية اتصالاً مباشرًا بالخادم." },
};
function termStrings(language?: string): Record<TermKey, string> {
  const code = (language ?? "es").slice(0, 2).toLowerCase();
  return TERM_STRINGS[code] ?? TERM_STRINGS.en;
}

// ── Tema xterm coherente con daisyUI (canvas: colores concretos, no CSS vars) ─
const DARK_THEME: ITheme = {
  background: "#0b0f1a",
  foreground: "#e5e7eb",
  cursor: "#e5e7eb",
  cursorAccent: "#0b0f1a",
  selectionBackground: "#334155",
  black: "#1e293b",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#fbbf24",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#e5e7eb",
  brightBlack: "#475569",
  brightRed: "#fca5a5",
  brightGreen: "#86efac",
  brightYellow: "#fde047",
  brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9",
  brightWhite: "#f8fafc",
};
const LIGHT_THEME: ITheme = {
  background: "#f8fafc",
  foreground: "#1f2937",
  cursor: "#1f2937",
  cursorAccent: "#f8fafc",
  selectionBackground: "#cbd5e1",
  black: "#1e293b",
  red: "#dc2626",
  green: "#16a34a",
  yellow: "#ca8a04",
  blue: "#2563eb",
  magenta: "#9333ea",
  cyan: "#0891b2",
  white: "#e2e8f0",
  brightBlack: "#64748b",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#3b82f6",
  brightMagenta: "#a855f7",
  brightCyan: "#06b6d4",
  brightWhite: "#f8fafc",
};
const themeFor = (t: ThemeMode): ITheme => (t === "light" ? LIGHT_THEME : DARK_THEME);

/** Deriva la URL del WS del PTY a partir del `DirectTarget` (http→ws, https→wss). */
function directWsUrl(target: DirectTarget): string {
  const base = target.baseUrl.replace(/\/+$/, "").replace(/^http/i, "ws");
  return `${base}/api/terminal/ws?token=${encodeURIComponent(target.jwt)}`;
}

export function TerminalModule({ serverId, language, theme }: ModuleProps) {
  const s = termStrings(language);
  const c = getMessages(language).common;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<Status>("connecting");
  const [connectKey, setConnectKey] = useState(0);

  const hasDirect = useMemo(() => Boolean(getDirect(serverId)), [serverId, connectKey]);

  const sendResize = useCallback(() => {
    const term = termRef.current;
    const ws = wsRef.current;
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    } catch {
      /* ignore */
    }
  }, []);

  // ── Montaje de xterm (una vez): addon-fit, ResizeObserver, onData ──────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const term = new Terminal({
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
      cursorBlink: true,
      scrollback: 5000,
      theme: themeFor(theme),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    try {
      fit.fit();
    } catch {
      /* container aún sin tamaño: el ResizeObserver reintenta */
    }
    termRef.current = term;
    fitRef.current = fit;

    // Entrada del usuario → PTY del box.
    const onData = term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "input", data }));
        } catch {
          /* ignore */
        }
      }
    });

    // Re-fit ante cambios de tamaño del contenedor → avisa al PTY.
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        /* ignore */
      }
      sendResize();
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      onData.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // Montaje único: el tema se aplica por su propio efecto; el WS por otro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tema en caliente (light/dark del panel) ────────────────────────────────
  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = themeFor(theme);
  }, [theme]);

  // ── WebSocket al box (por `connectKey`): abre, sirve el protocolo, limpia ───
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    // Refresca el target del registro en cada (re)conexión: recoge un JWT nuevo
    // si `directAuth` lo renovó tras un 401 en otra parte de la app.
    const target = getDirect(serverId);
    if (!target) {
      setStatus("error");
      return;
    }

    setStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(directWsUrl(target));
    } catch {
      setStatus("error");
      return;
    }
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const stopPing = () => {
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
    };

    ws.onopen = () => {
      setStatus("connected");
      try {
        fitRef.current?.fit();
      } catch {
        /* ignore */
      }
      // Resize inicial explícito + keepalive.
      try {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      } catch {
        /* ignore */
      }
      term.focus();
      stopPing();
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
          } catch {
            /* ignore */
          }
        }
      }, 20000);
    };

    ws.onmessage = (ev: MessageEvent) => {
      const raw = ev.data;
      // El box habla JSON (output/connected/exit/error/pong). Si por lo que sea
      // llega texto/binario crudo del PTY, se pinta tal cual (paridad con app).
      if (typeof raw === "string") {
        let msg: { type?: string; data?: string; message?: string } | null = null;
        try {
          msg = JSON.parse(raw);
        } catch {
          term.write(raw);
          return;
        }
        if (!msg || !msg.type) {
          term.write(raw);
          return;
        }
        switch (msg.type) {
          case "output":
            if (typeof msg.data === "string") term.write(msg.data);
            break;
          case "connected":
          case "pong":
            break;
          case "exit":
            setStatus("disconnected");
            break;
          case "error":
            if (msg.message) term.write(`\r\n\x1b[31m${msg.message}\x1b[0m\r\n`);
            setStatus("error");
            break;
          default:
            break;
        }
        return;
      }
      try {
        const text = new TextDecoder().decode(new Uint8Array(raw as ArrayBuffer));
        if (text) term.write(text);
      } catch {
        /* frame ilegible */
      }
    };

    ws.onclose = () => {
      stopPing();
      if (wsRef.current === ws) wsRef.current = null;
      setStatus((prev) => (prev === "error" ? prev : "disconnected"));
    };
    ws.onerror = () => {
      setStatus("error");
    };

    return () => {
      stopPing();
      try {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      } catch {
        /* ignore */
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [serverId, connectKey]);

  const reconnect = useCallback(() => {
    const term = termRef.current;
    if (term) term.reset();
    // Si el JWT venció, intenta un relogin silencioso antes de reconectar; el
    // registro directo queda con un target fresco y `directWsUrl` toma el nuevo.
    const target = getDirect(serverId);
    if (target?.relogin && target.exp && target.exp < Date.now()) {
      void target.relogin().finally(() => setConnectKey((k) => k + 1));
      return;
    }
    setConnectKey((k) => k + 1);
  }, [serverId]);

  // ── Sin conexión directa: el terminal nativo no aplica (modo gateway) ──────
  if (!hasDirect) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{s.title}</h2>
        <div className="flex max-w-xl flex-col items-start gap-2 rounded-xl border border-base-300 bg-base-100 p-5">
          <p className="text-sm text-error">{s.unavailable}</p>
          <p className="text-sm text-base-content/70">{s.unavailableHint}</p>
        </div>
      </div>
    );
  }

  const statusLabel =
    status === "connected"
      ? s.connected
      : status === "connecting"
        ? s.connecting
        : status === "error"
          ? s.connError
          : s.disconnected;
  const statusDotClass =
    status === "connected"
      ? "bg-success"
      : status === "connecting"
        ? "bg-warning animate-pulse"
        : "bg-error";
  const showReconnect = status === "disconnected" || status === "error";

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera + estado + reconectar (estilo MonitorModule) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <TerminalIcon size={18} className="text-primary" />
          <div className="flex min-w-0 flex-col">
            <h2 className="text-base font-semibold leading-tight">{s.title}</h2>
            <p className="text-xs text-base-content/60">{s.subtitle}</p>
          </div>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-base-300 bg-base-100 px-2.5 py-1 text-xs font-medium">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
          {statusLabel}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm gap-1"
          onClick={reconnect}
          disabled={status === "connecting"}
        >
          <RefreshCw size={14} /> {showReconnect ? s.reconnect : c.refresh}
        </button>
      </div>

      {/* Superficie xterm */}
      <div
        className="relative overflow-hidden rounded-xl border border-base-300"
        style={{ height: "70vh", minHeight: 360, backgroundColor: themeFor(theme).background }}
      >
        <div ref={hostRef} className="h-full w-full p-2" />
        {showReconnect ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-base-100/70 backdrop-blur-sm">
            <p className="text-sm text-base-content/80">{statusLabel}</p>
            <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={reconnect}>
              <RefreshCw size={14} /> {s.reconnect}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
