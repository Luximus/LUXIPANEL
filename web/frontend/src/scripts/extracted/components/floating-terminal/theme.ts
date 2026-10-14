// Floating terminal — xterm theme palette resolution + live theme sync.
import { S, sessions, type TerminalThemePalette, type TerminalThemePreset } from "./state";
import { DEFAULT_CUSTOM_LAYOUT_COLOR } from "@/lib/layout-palettes";
import { THEME_CHANGE_EVENT } from "@/lib/theme-storage-keys";

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeHexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && isHexColor(value) ? value : fallback;
}

function rgbaFromHex(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

const XTERM_THEME_PRESETS: Record<Exclude<TerminalThemePreset, "custom">, TerminalThemePalette> = {
  default: {
    ...getDefaultTerminalTheme(),
  },
  xterm: {
    background: "#000000",
    foreground: "#f5f5f5",
    cursor: "#ffffff",
    cursorAccent: "#000000",
    selectionBackground: "#ffffff33",
    black: "#000000",
    red: "#cd0000",
    green: "#00cd00",
    yellow: "#cdcd00",
    blue: "#0000cd",
    magenta: "#cd00cd",
    cyan: "#00cdcd",
    white: "#e5e5e5",
    brightBlack: "#7f7f7f",
    brightRed: "#ff0000",
    brightGreen: "#00ff00",
    brightYellow: "#ffff00",
    brightBlue: "#5c5cff",
    brightMagenta: "#ff00ff",
    brightCyan: "#00ffff",
    brightWhite: "#ffffff",
  },
};

function getDefaultTerminalTheme(): TerminalThemePalette {
  if (document.documentElement.classList.contains("dark")) {
    return {
      background: "#0f1115",
      foreground: "#e5e7eb",
      cursor: "#34d399",
      cursorAccent: "#0f1115",
      selectionBackground: "#34d39933",
      selection: "#34d39933",
      black: "#111827",
      red: "#f87171",
      green: "#4ade80",
      yellow: "#facc15",
      blue: "#60a5fa",
      magenta: "#c084fc",
      cyan: "#34d399",
      white: "#d4d4d4",
      brightBlack: "#52525b",
      brightRed: "#fca5a5",
      brightGreen: "#86efac",
      brightYellow: "#fde047",
      brightBlue: "#93c5fd",
      brightMagenta: "#e9d5ff",
      brightCyan: "#6ee7b7",
      brightWhite: "#f8fafc",
    };
  }

  return {
    background: "#f8fafc",
    foreground: "#0f172a",
    cursor: "#0f766e",
    cursorAccent: "#ffffff",
    selectionBackground: "#cbd5e155",
    selection: "#cbd5e155",
    black: "#0f172a",
    red: "#dc2626",
    green: "#16a34a",
    yellow: "#ca8a04",
    blue: "#2563eb",
    magenta: DEFAULT_CUSTOM_LAYOUT_COLOR,
    cyan: "#0f766e",
    white: "#334155",
    brightBlack: "#64748b",
    brightRed: "#ef4444",
    brightGreen: "#22c55e",
    brightYellow: "#eab308",
    brightBlue: "#3b82f6",
    brightMagenta: "#a855f7",
    brightCyan: "#14b8a6",
    brightWhite: "#0f172a",
  };
}

function getTerminalTheme(): TerminalThemePalette {
  const config = S.terminalThemeConfig;
  const fallback = getDefaultTerminalTheme();

  if (config.preset === "xterm") {
    return XTERM_THEME_PRESETS.xterm;
  }

  if (config.preset === "custom") {
    const base = fallback;
    const custom = config.colors;
    const background = normalizeHexColor(custom.background, base.background);
    const foreground = normalizeHexColor(custom.foreground, base.foreground);
    const cursor = normalizeHexColor(custom.cursor, base.cursor);
    const selectionBackground = normalizeHexColor(custom.selectionBackground, rgbaFromHex(cursor, "33"));

    return {
      background,
      foreground,
      cursor,
      cursorAccent: normalizeHexColor(custom.cursorAccent, background),
      selectionBackground,
      selection: selectionBackground,
      black: normalizeHexColor(custom.black, base.black),
      red: normalizeHexColor(custom.red, base.red),
      green: normalizeHexColor(custom.green, base.green),
      yellow: normalizeHexColor(custom.yellow, base.yellow),
      blue: normalizeHexColor(custom.blue, base.blue),
      magenta: normalizeHexColor(custom.magenta, base.magenta),
      cyan: normalizeHexColor(custom.cyan, base.cyan),
      white: normalizeHexColor(custom.white, base.white),
      brightBlack: normalizeHexColor(custom.brightBlack, base.brightBlack),
      brightRed: normalizeHexColor(custom.brightRed, base.brightRed),
      brightGreen: normalizeHexColor(custom.brightGreen, base.brightGreen),
      brightYellow: normalizeHexColor(custom.brightYellow, base.brightYellow),
      brightBlue: normalizeHexColor(custom.brightBlue, base.brightBlue),
      brightMagenta: normalizeHexColor(custom.brightMagenta, base.brightMagenta),
      brightCyan: normalizeHexColor(custom.brightCyan, base.brightCyan),
      brightWhite: normalizeHexColor(custom.brightWhite, base.brightWhite),
    };
  }

  return fallback;
}

function syncTerminalThemeControls(): void {
  const presetSelect = document.getElementById("s-terminal-theme-preset") as HTMLSelectElement | null;
  if (presetSelect) presetSelect.value = S.terminalThemeConfig.preset;

  const customFields = document.getElementById("terminal-custom-theme-fields");
  const isCustom = S.terminalThemeConfig.preset === "custom";
  customFields?.classList.toggle("hidden", !isCustom);

  if (!isCustom) return;

  const base = getDefaultTerminalTheme();
  const values = { ...base, ...S.terminalThemeConfig.colors };
  const map: Record<string, string> = {
    background: values.background,
    foreground: values.foreground,
    cursor: values.cursor,
    selection: values.selectionBackground.slice(0, 7),
    red: values.red,
    green: values.green,
    yellow: values.yellow,
    blue: values.blue,
    magenta: values.magenta,
    cyan: values.cyan,
    "bright-black": values.brightBlack,
    "bright-red": values.brightRed,
    "bright-green": values.brightGreen,
    "bright-yellow": values.brightYellow,
    "bright-blue": values.brightBlue,
    "bright-magenta": values.brightMagenta,
    "bright-cyan": values.brightCyan,
    "bright-white": values.brightWhite,
  };

  for (const [suffix, value] of Object.entries(map)) {
    const input = document.getElementById(`s-terminal-theme-${suffix}`) as HTMLInputElement | null;
    if (input) input.value = normalizeHexColor(value, base.background);
  }
}

function collectTerminalCustomColors(): Partial<TerminalThemePalette> {
  const mapping: Array<[keyof TerminalThemePalette, string]> = [
    ["background", "background"],
    ["foreground", "foreground"],
    ["cursor", "cursor"],
    ["selectionBackground", "selection"],
    ["red", "red"],
    ["green", "green"],
    ["yellow", "yellow"],
    ["blue", "blue"],
    ["magenta", "magenta"],
    ["cyan", "cyan"],
    ["brightBlack", "bright-black"],
    ["brightRed", "bright-red"],
    ["brightGreen", "bright-green"],
    ["brightYellow", "bright-yellow"],
    ["brightBlue", "bright-blue"],
    ["brightMagenta", "bright-magenta"],
    ["brightCyan", "bright-cyan"],
    ["brightWhite", "bright-white"],
  ];
  const result: Partial<TerminalThemePalette> = {};
  for (const [key, suffix] of mapping) {
    const input = document.getElementById(`s-terminal-theme-${suffix}`) as HTMLInputElement | null;
    if (input?.value && isHexColor(input.value)) result[key] = input.value;
  }
  return result;
}

  let terminalThemeSyncSetupDone = false;

  function syncTerminalTheme(): void {
  const theme = getTerminalTheme();
  sessions.forEach((session) => {
    const termAny = session.term as any;
    if (termAny?.options) {
      termAny.options.theme = theme;
    } else if (typeof termAny?.setOption === "function") {
      termAny.setOption("theme", theme);
    }
    if (typeof termAny?.refresh === "function") {
      termAny.refresh(0, Math.max(0, session.term.rows - 1));
    }
  });
}

  function ensureTerminalThemeSync(): void {
    if (terminalThemeSyncSetupDone) return;
    terminalThemeSyncSetupDone = true;

    const observer = new MutationObserver(() => syncTerminalTheme());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener(THEME_CHANGE_EVENT, syncTerminalTheme as EventListener);
    document.addEventListener("astro:after-swap", syncTerminalTheme);
  }

  function applyTerminalThemeToSessions(): void {
    syncTerminalTheme();
  }

export {
  getTerminalTheme,
  syncTerminalTheme,
  ensureTerminalThemeSync,
  syncTerminalThemeControls,
  collectTerminalCustomColors,
  applyTerminalThemeToSessions,
};
