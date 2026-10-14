// Floating terminal — PTY input processing, status/path helpers, WS auth
// token and mobile keyboard bar.
import { S, sessions } from "./state";
import { resolvePanelApiPath, SESSION_COOKIE_NAME } from "@/lib/api-client";
import { WS_TOKEN_PATH } from "@/lib/api-routes";
import { TerminalWsMsg } from "@/lib/terminal-ws-protocol";
import { pushHistory } from "./history";
import { I18N } from "./i18n";

function setStatus(msg: string, connected: boolean) {
    const statusEl = document.getElementById("terminal-status");
    const reconnectBtn = document.getElementById("btn-reconnect");
    // `msg` composes pid/code/message/reason coming from WS frames (unescaped),
    // so build the node via DOM APIs and put the text through textContent — never
    // innerHTML — to avoid XSS from crafted server/session frames.
    if (statusEl) {
      statusEl.title = msg;
      statusEl.setAttribute("aria-label", msg);
      statusEl.dataset.state = connected ? "connected" : msg === I18N.status.reconnecting ? "reconnecting" : "disconnected";
      const dot = statusEl.querySelector<HTMLElement>("[data-terminal-status-dot]");
      const pending = msg === I18N.status.reconnecting;
      if (dot) dot.className = `h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500" : pending ? "bg-amber-500 animate-pulse" : "bg-destructive"}`;
      const tooltip = document.getElementById("terminal-status-tooltip");
      if (tooltip) tooltip.textContent = msg;
    }
    if (reconnectBtn) reconnectBtn.classList.toggle("hidden", connected);
}
function normalizePath(path: string): string {
  if (!path) return "/";
  const withSlashes = path.replaceAll("\\", "/");
  const parts = withSlashes.split("/").filter((p) => p && p !== ".");
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return `/${stack.join("/")}`;
}
function resolveCdPath(basePath: string, rawTarget: string): string {
  const target = (rawTarget || "").trim().replace(/^['"]|['"]$/g, "");
  if (!target || target === "~") return "/";
  if (target.startsWith("/")) return normalizePath(target);
  return normalizePath(`${basePath || "/"}${basePath?.endsWith("/") ? "" : "/"}${target}`);
}
function emitTerminalCwd(path: string) {
  const normalized = normalizePath(path);
  window.dispatchEvent(new CustomEvent("luxipanel:terminal-cwd-changed", { detail: { path: normalized } }));
}

  function getToken(): string {
    return document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.split("=")[1] ?? "";
  }

  let websocketTokenCache: { token: string; expiresAt: number } | null = null;

  async function getWebsocketToken(): Promise<string> {
    const cookieToken = getToken();
    if (cookieToken) return cookieToken;

    if (websocketTokenCache && websocketTokenCache.expiresAt - Date.now() > 15_000) {
      return websocketTokenCache.token;
    }

    const res = await fetch(resolvePanelApiPath(WS_TOKEN_PATH), {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).catch(() => null);
    if (!res) return "";
    if (!res.ok) return "";

    const json = await res.json().catch(() => null) as { data?: { token?: string; expiresAt?: number } } | null;
    const token = typeof json?.data?.token === "string" ? json.data.token : "";
    const expiresAt = typeof json?.data?.expiresAt === "number" ? json.data.expiresAt : 0;
    if (token && expiresAt > Date.now()) {
      websocketTokenCache = { token, expiresAt };
    }
    return token;
  }

  // Procesa input destinado a la PTY: actualiza estado local (lineBuffer/cursorPos,
  // tracking de cwd, historial) y reenvía el dato bruto por el WebSocket. Se
  // invoca tanto desde `term.onData` (teclado físico) como desde la barra de
  // teclas móvil (flechas en pantalla).
  function processTerminalInput(tabId: number, data: string): void {
    const sess = sessions.get(tabId);
    if (!sess) return;

    const deleteBackward = () => {
      if (sess.cursorPos <= 0) return;
      sess.lineBuffer = `${sess.lineBuffer.slice(0, sess.cursorPos - 1)}${sess.lineBuffer.slice(sess.cursorPos)}`;
      sess.cursorPos--;
    };

    const deleteForward = () => {
      if (sess.cursorPos >= sess.lineBuffer.length) return;
      sess.lineBuffer = `${sess.lineBuffer.slice(0, sess.cursorPos)}${sess.lineBuffer.slice(sess.cursorPos + 1)}`;
    };

    const deletePrevWord = () => {
      const left = sess.lineBuffer.slice(0, sess.cursorPos).replace(/\s+$/, "");
      const nextCursor = left.replace(/[^\s]+$/, "").length;
      sess.lineBuffer = `${sess.lineBuffer.slice(0, nextCursor)}${sess.lineBuffer.slice(sess.cursorPos)}`;
      sess.cursorPos = nextCursor;
    };

    if (data === "\r" || data === "\n") {
      const cmd = sess.lineBuffer.trim();
      if (cmd) pushHistory(cmd);
      if (cmd.startsWith("cd")) {
        const cdTarget = cmd.replace(/^cd\s*/, "");
        sess.cwd = resolveCdPath(sess.cwd || "/", cdTarget);
        emitTerminalCwd(sess.cwd);
      }
      sess.lineBuffer = "";
      sess.cursorPos = 0;
      sess.historyIdx = -1;
    } else if (data === "\x7f" || data === "\b") {
      deleteBackward();
    } else if (data === "\x15") {
      sess.lineBuffer = sess.lineBuffer.slice(sess.cursorPos);
      sess.cursorPos = 0;
    } else if (data === "\x0b") {
      sess.lineBuffer = sess.lineBuffer.slice(0, sess.cursorPos);
    } else if (data === "\x17") {
      deletePrevWord();
    } else if (data === "\x01") {
      sess.cursorPos = 0;
    } else if (data === "\x05") {
      sess.cursorPos = sess.lineBuffer.length;
    } else if (data === "\x03" || data === "\x04") {
      sess.lineBuffer = "";
      sess.cursorPos = 0;
    } else if (data === "\x1b[D") {
      sess.cursorPos = Math.max(0, sess.cursorPos - 1);
    } else if (data === "\x1b[C") {
      sess.cursorPos = Math.min(sess.lineBuffer.length, sess.cursorPos + 1);
    } else if (data === "\x1b[H" || data === "\x1b[1~" || data === "\x1bOH") {
      sess.cursorPos = 0;
    } else if (data === "\x1b[F" || data === "\x1b[4~" || data === "\x1bOF") {
      sess.cursorPos = sess.lineBuffer.length;
    } else if (data === "\x1b[3~") {
      deleteForward();
    } else if (data.length > 1 && !data.startsWith("\x1b")) {
      sess.lineBuffer = `${sess.lineBuffer.slice(0, sess.cursorPos)}${data}${sess.lineBuffer.slice(sess.cursorPos)}`;
      sess.cursorPos += data.length;
    } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
      sess.lineBuffer = `${sess.lineBuffer.slice(0, sess.cursorPos)}${data}${sess.lineBuffer.slice(sess.cursorPos)}`;
      sess.cursorPos += data.length;
    }

    if (sess.ws && sess.ws.readyState === WebSocket.OPEN) {
      sess.ws.send(JSON.stringify({ type: TerminalWsMsg.INPUT, data }));
    }
  }


  // Mapa código→secuencia para la barra de teclas móvil. Se mantiene mínimo
  // y centrado en flechas, que son las teclas que no aparecen en el teclado
  // virtual nativo del sistema operativo.
  // Secuencias base para cada tecla del bar móvil. Las que admiten Ctrl van
  // en MOBILE_KEY_CTRL con el modifier CSI 5 estándar de xterm. Alt se aplica
  // anteponiendo ESC (0x1b) a la secuencia base (convención xterm / readline
  // M-x).
  const MOBILE_KEY_SEQUENCES: Record<string, string> = {
    up: "\x1b[A",
    down: "\x1b[B",
    left: "\x1b[D",
    right: "\x1b[C",
    esc: "\x1b",
    tab: "\t",
    home: "\x1b[H",
    end: "\x1b[F",
    pgup: "\x1b[5~",
    pgdn: "\x1b[6~",
    slash: "/",
  };

  const MOBILE_KEY_CTRL: Record<string, string> = {
    up: "\x1b[1;5A",
    down: "\x1b[1;5B",
    left: "\x1b[1;5D",
    right: "\x1b[1;5C",
    home: "\x1b[1;5H",
    end: "\x1b[1;5F",
    pgup: "\x1b[5;5~",
    pgdn: "\x1b[6;5~",
  };

  // Sticky-modifier state: tras pulsar CTRL/ALT, la próxima tecla del bar
  // móvil se compone con ese modificador y luego se libera. Si el usuario
  // pulsa CTRL otra vez sin haber consumido, se desarma.


  function setMobileKeyPressed(button: HTMLElement | null, pressed: boolean) {
    if (!button) return;
    button.classList.toggle("bg-primary/20", pressed);
    button.classList.toggle("border-primary/40", pressed);
    button.classList.toggle("text-primary", pressed);
    button.setAttribute("aria-pressed", String(pressed));
  }

  function clearMobileKeyModifiers() {
    if (S.mobileKeyPendingCtrl) {
      S.mobileKeyPendingCtrl = false;
      setMobileKeyPressed(document.querySelector('#lxp-terminal-mobilekeys [data-tk="ctrl"]'), false);
    }
    if (S.mobileKeyPendingAlt) {
      S.mobileKeyPendingAlt = false;
      setMobileKeyPressed(document.querySelector('#lxp-terminal-mobilekeys [data-tk="alt"]'), false);
    }
  }

  function resolveMobileKeySequence(key: string): string | null {
    const base = MOBILE_KEY_SEQUENCES[key];
    if (!base) return null;
    let seq = S.mobileKeyPendingCtrl && MOBILE_KEY_CTRL[key] ? MOBILE_KEY_CTRL[key] : base;
    if (S.mobileKeyPendingAlt) seq = "\x1b" + seq;
    return seq;
  }

  // Estilo Termux: si hay un modificador sticky armado (CTRL/ALT del bar móvil),
  // se aplica al SIGUIENTE carácter escrito en el teclado físico/virtual del SO,
  // no sólo a las teclas del bar. CTRL convierte la letra en su carácter de
  // control (Ctrl+C → \x03, Ctrl+D → \x04, …) vía `& 0x1f`; ALT antepone ESC
  // (convención xterm / readline M-x). Sólo transforma un único carácter
  // imprimible suelto; cualquier otra entrada (secuencias, backspace, pegado
  // multi-char) pasa intacta y deja el modificador armado. Tras componer, libera
  // el modificador (one-shot, como el bar).
  function applyMobileKeyModifiersToTyped(data: string): string {
    if (!S.mobileKeyPendingCtrl && !S.mobileKeyPendingAlt) return data;
    if (data.length !== 1 || data.charCodeAt(0) < 0x20) return data;
    let out = data;
    if (S.mobileKeyPendingCtrl) out = String.fromCharCode(out.toUpperCase().charCodeAt(0) & 0x1f);
    if (S.mobileKeyPendingAlt) out = "\x1b" + out;
    clearMobileKeyModifiers();
    return out;
  }

export {
  setStatus,
  normalizePath,
  resolveCdPath,
  emitTerminalCwd,
  getWebsocketToken,
  processTerminalInput,
  applyMobileKeyModifiersToTyped,
  setMobileKeyPressed,
  clearMobileKeyModifiers,
  resolveMobileKeySequence,
};
