// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useRef, useState } from "react";
import { useDeferredClose } from "@/components/ui/use-deferred-close";
import { backdropMotionClass, CENTERED_CARD_ENTER, CENTERED_CARD_EXIT } from "@/components/ui/ModalShell";
import { cn } from "@/lib/utils";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { createPortal } from "react-dom";
import { useBodyPointerEventsWhileOpen } from "@/lib/body-pointer-events";
import { useAssistantI18n } from "./i18n";

/**
 * Read-only mini-terminal that renders a CLI provider's live output (ANSI)
 * inside a chat bubble. Reuses the same xterm build the Terminal module loads
 * from the CDN (offline panels already depend on it for the floating
 * terminal). Display-only: no stdin, no WebSocket — the bytes arrive as the
 * `output` prop, accumulated by the chat engine from the SSE stream.
 *
 * The box is expandable: a maximize button (and clicking the box) opens a
 * full-screen modal with the same output at full height + scroll. Works for
 * both live (running) consoles and reloaded-from-history ones.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type XtermMods = { Terminal: any; FitAddon: any };
let xtermMods: Promise<XtermMods> | null = null;

function readDark(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

/** Near-black console for dark mode. */
const DARK_TERMINAL_THEME = { background: "#0a0a0a", foreground: "#e4e4e7" };

/**
 * Light-mode console: soft gray background with dark text so it contrasts with
 * the white page instead of being a stark black box. ANSI colors are darkened
 * to stay legible on a light surface.
 */
const LIGHT_TERMINAL_THEME = {
  background: "#e5e7eb",
  foreground: "#1f2937",
  cursor: "#0f766e",
  cursorAccent: "#e5e7eb",
  selectionBackground: "#94a3b855",
  black: "#0f172a",
  red: "#dc2626",
  green: "#15803d",
  yellow: "#b45309",
  blue: "#2563eb",
  magenta: "#7c3aed",
  cyan: "#0e7490",
  white: "#334155",
  brightBlack: "#64748b",
  brightRed: "#ef4444",
  brightGreen: "#16a34a",
  brightYellow: "#a16207",
  brightBlue: "#3b82f6",
  brightMagenta: "#a855f7",
  brightCyan: "#0891b2",
  brightWhite: "#0f172a",
};

function loadXterm(): Promise<XtermMods> {
  if (!xtermMods) {
    if (typeof document !== "undefined" && !document.getElementById("xterm-css-cdn")) {
      const link = document.createElement("link");
      link.id = "xterm-css-cdn";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css";
      document.head.appendChild(link);
    }
    xtermMods = (async () => {
      const x: any = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/+esm");
      const f: any = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/+esm");
      return { Terminal: x.Terminal, FitAddon: f.FitAddon };
    })();
  }
  return xtermMods;
}

/**
 * Full-screen overlay shown above everything (rendered via portal to escape the
 * drawer's `overflow-hidden`). Rounded X button, click-outside / Escape to
 * close. The body scrolls; children own the visible area.
 */
export function CliFullscreenModal({ onClose: onCloseProp, children }: { onClose(): void; children: React.ReactNode }) {
  const closeLabel = useAssistantI18n().chatTab.toolTrace.closeFullscreen;
  // Mounted == open: keep the body interactive above the drawer.
  useBodyPointerEventsWhileOpen(true);
  // Exit animation (200ms ease-out, motion standard) before unmount.
  const { closing, requestClose } = useDeferredClose(onCloseProp);
  const onClose = () => requestClose();
  useEscapeToClose(onClose);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[10000] flex flex-col bg-black/85 backdrop-blur-sm p-3 sm:p-6", backdropMotionClass(closing), closing && "pointer-events-none")}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      // This modal is portal'd to <body>, a SIBLING of the assistant drawer.
      // The drawer (vaul) uses Radix's DismissableLayer, which listens on
      // `pointerdown`/`click` at document level (bubble phase) to detect
      // "outside" interactions. Without stopping these here, clicking the
      // close button reads as an outside click and closes the whole drawer.
      // `mousedown` alone is ineffective — Radix never listens to it.
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white shadow-lg transition hover:bg-white/25"
      >
        <i className="ti ti-x text-xl" aria-hidden></i>
      </button>
      <div
        className={cn("mt-12 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/95 shadow-2xl", closing ? CENTERED_CARD_EXIT : CENTERED_CARD_ENTER)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function MaximizeButton({ onClick }: { onClick(): void }) {
  const label = useAssistantI18n().chatTab.toolTrace.expandFullscreen;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={label}
      aria-label={label}
      className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-zinc-200 opacity-70 transition hover:bg-white/25 hover:opacity-100"
    >
      <i className="ti ti-arrows-maximize text-[12px]" aria-hidden></i>
    </button>
  );
}

/**
 * One terminal lane (orchestrator or a sub-agent). Structural shape — mirrors
 * `CliLane` from chat-engine without importing it (avoids a module cycle).
 */
export interface TerminalLane {
  id: string;
  title: string;
  subagentType?: string;
  status?: "running" | "done" | "failed";
  output: string;
}

function statusDotClass(status?: string): string {
  if (status === "done") return "bg-emerald-500";
  if (status === "failed") return "bg-red-500";
  return "bg-amber-400 animate-pulse";
}

/**
 * Tab strip for a multi-agent CLI run: one tab per lane, orchestrator first.
 * Each tab shows an icon, the agent's label and a live status dot. Clicking a
 * tab switches which lane's terminal is visible.
 */
function LaneTabs({
  lanes,
  laneOrder,
  selected,
  onSelect,
}: {
  lanes: Record<string, TerminalLane>;
  laneOrder: string[];
  selected: string;
  onSelect(id: string): void;
}) {
  const tt = useAssistantI18n().chatTab.toolTrace;
  return (
    <div className="mb-1 flex items-center gap-1 overflow-x-auto border-b border-border/60 pb-1 pr-8">
      {laneOrder.map((id) => {
        const lane = lanes[id];
        if (!lane) return null;
        const isMain = id === "main";
        const active = id === selected;
        // Label: orchestrator (main) and the sub-agent's description; fall back to
        // a localized "subagent" when the engine hasn't named the lane yet.
        const label = isMain ? tt.orchestrator : (lane.title || tt.subagent);
        return (
          <button
            key={id}
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect(id); }}
            title={lane.subagentType ? `${label} · ${lane.subagentType}` : label}
            className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] whitespace-nowrap transition ${
              active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-background/60"
            }`}
          >
            <i className={`ti ${isMain ? "ti-hierarchy-2" : "ti-robot-face"} text-[11px]`} aria-hidden></i>
            <span className="max-w-[130px] truncate">{label}</span>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDotClass(lane.status)}`} />
          </button>
        );
      })}
    </div>
  );
}

export function CliTerminalView({
  output,
  lanes,
  laneOrder,
  running,
  fullscreen = false,
  bare = false,
  selectedLane,
  onSelectLane,
}: {
  /** Legacy single-buffer mode (history / non-multi-agent). */
  output?: string;
  /** Multi-agent mode: per-lane terminal buffers (orchestrator + sub-agents). */
  lanes?: Record<string, TerminalLane>;
  /** Display order of {@link lanes}; first entry is the default tab. */
  laneOrder?: string[];
  running: boolean;
  /** When true the terminal fills its parent (used inside the modal). */
  fullscreen?: boolean;
  /** Drop the outer box chrome (border/rounded/bg) when the parent already provides it. */
  bare?: boolean;
  /** Controlled selected lane (used to mirror selection into the modal). */
  selectedLane?: string;
  onSelectLane?(id: string): void;
}) {
  const tt = useAssistantI18n().chatTab.toolTrace;
  const tabbed = !!lanes && !!laneOrder && laneOrder.length > 0;
  const [selfSelected, setSelfSelected] = useState<string>(laneOrder?.[0] ?? "main");
  const rawSelected = selectedLane ?? selfSelected;
  // Guard against a selection that no longer exists (lane list can grow/shrink).
  const selected = tabbed && lanes![rawSelected] ? rawSelected : (laneOrder?.[0] ?? "main");
  const setSelected = onSelectLane ?? setSelfSelected;

  const activeOutput = tabbed ? (lanes![selected]?.output ?? "") : (output ?? "");
  const laneStatus = tabbed ? lanes![selected]?.status : undefined;
  const showRunning = tabbed ? laneStatus === "running" : running;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const written = useRef(0);
  const lastLaneKey = useRef<string>(selected);
  const outputRef = useRef(activeOutput);
  outputRef.current = activeOutput;
  const [expanded, setExpanded] = useState(false);
  const [isDark, setIsDark] = useState(readDark);

  // Track theme toggles so the console flips between light/dark live.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() => setIsDark(readDark()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Re-apply the palette to the live xterm instance on theme change.
  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = isDark ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME;
  }, [isDark]);

  // Create the xterm instance once and keep it for this component's lifetime.
  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    void loadXterm().then(({ Terminal, FitAddon }) => {
      if (cancelled || !hostRef.current || termRef.current) return;
      const term = new Terminal({
        convertEol: true, // map lone \n → \r\n so output doesn't staircase
        cursorBlink: false,
        disableStdin: true,
        fontSize: fullscreen ? 13 : 11,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        scrollback: 5000,
        theme: readDark() ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(hostRef.current);
      try { fit.fit(); } catch { /* container not laid out yet */ }
      termRef.current = term;
      fitRef.current = fit;
      // Flush whatever output already accumulated before mount.
      if (outputRef.current) {
        term.write(outputRef.current);
        written.current = outputRef.current.length;
      }
      lastLaneKey.current = selected;
      // Refit when the bubble/terminal resizes (e.g. user expands it later).
      ro = new ResizeObserver(() => { try { fit.fit(); } catch { /* noop */ } });
      ro.observe(hostRef.current);
    });
    return () => {
      cancelled = true;
      ro?.disconnect();
      try { termRef.current?.dispose(); } catch { /* noop */ }
      termRef.current = null;
    };
  }, [fullscreen]);

  // Stream new output deltas into the terminal. On a tab switch the visible
  // lane changes entirely, so clear and replay that lane's buffer from scratch.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    if (selected !== lastLaneKey.current) {
      term.clear();
      written.current = 0;
      lastLaneKey.current = selected;
    }
    if (activeOutput.length < written.current) {
      // Buffer was reset/replaced — clear and rewrite from scratch.
      term.clear();
      written.current = 0;
    }
    if (activeOutput.length > written.current) {
      term.write(activeOutput.slice(written.current));
      written.current = activeOutput.length;
      if (fullscreen) term.scrollToBottom();
    }
  }, [activeOutput, selected, fullscreen]);

  return (
    <div className={fullscreen ? "flex min-h-0 flex-1 flex-col bg-gray-200 dark:bg-black/95 p-1" : bare ? "relative p-1" : "relative rounded-md border border-border/60 bg-gray-200 dark:bg-black/95 p-1"}>
      {!fullscreen && <MaximizeButton onClick={() => setExpanded(true)} />}
      {tabbed && laneOrder!.length > 1 && (
        <LaneTabs lanes={lanes!} laneOrder={laneOrder!} selected={selected} onSelect={setSelected} />
      )}
      <div
        ref={hostRef}
        className={fullscreen ? "min-h-0 w-full flex-1 overflow-hidden" : "h-64 w-full cursor-zoom-in overflow-hidden"}
        onClick={fullscreen ? undefined : () => setExpanded(true)}
      />
      {showRunning && (
        <div className="px-1 pt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400/80 flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
          {tt.runningOnServer}
        </div>
      )}
      {expanded && !fullscreen && (
        <CliFullscreenModal onClose={() => setExpanded(false)}>
          <CliTerminalView
            output={output}
            lanes={lanes}
            laneOrder={laneOrder}
            running={running}
            fullscreen
            selectedLane={selected}
            onSelectLane={setSelected}
          />
        </CliFullscreenModal>
      )}
    </div>
  );
}
