// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tool-trace disclosures + reloaded CLI history console + CLI job timer.
 * Extracted verbatim from the original `ChatPane.tsx`.
 */
import { useEffect, useState, type ReactNode } from "react";

import { useAssistantI18n } from "../i18n";
import { humanizeToolName } from "../assistant-api";
import { CliTerminalView, CliFullscreenModal } from "../CliTerminalView";
import { type ChatTurn } from "../chat-engine";
import { type ToolTraceLite } from "./types";
import CallChip, { type CallChipIcon } from "./reactbits/CallChip";
import { ChevronRight } from "lucide-react";

type ExecutionContentProps = { children?: ReactNode; attention?: ReactNode };

/**
 * One tool trace rendered as a collapsible `<details>`. For a CLI tool (the
 * server console) the disclosure starts collapsed, including while the agent
 * is working. The user can expand it whenever they want to watch the process.
 * Non-CLI tool traces stay collapsed by default (native uncontrolled).
 */
export function ToolDisclosure({ t, turn, uiMode, embedded = false, children, attention }: { t: ToolTraceLite; turn: ChatTurn; uiMode: "simple" | "advanced"; embedded?: boolean } & ExecutionContentProps) {
  const tt = useAssistantI18n().chatTab.toolTrace;
  const isCliTool = t.name.endsWith(".cli");
  const cliStartedAt = isCliTool && typeof (t.input as Record<string, unknown>).startedAt === "number"
    ? ((t.input as Record<string, unknown>).startedAt as number)
    : null;
  const human = uiMode === "simple" ? humanizeToolName(t.name) : null;
  const running = !t.result && !turn.stopped;
  const status = !t.result ? (turn.stopped ? "idle" : "running") : t.result.success ? "done" : "error";
  const statusLabel = !t.result ? (turn.stopped ? tt.stopped : tt.running) : t.result.success ? tt.done : tt.withWarnings;
  const icon: CallChipIcon = /search|find|query/i.test(t.name) ? "search" : /edit|write|patch/i.test(t.name) ? "edit" : /file|read/i.test(t.name) ? "file" : "terminal";

  // Keep manual toggles intact as the run changes state.
  const [consoleOpen, setConsoleOpen] = useState(false);

  // CLI console: ONE box only — the console container itself is the
  // collapsible (the <details> carries the terminal chrome, mirroring
  // CliHistoryView), with NO generic "Procesando" wrapper around it.
  if (isCliTool) {
    return (
      <details
        open={consoleOpen}
        onToggle={(e) => setConsoleOpen(e.currentTarget.open)}
        className={`group overflow-hidden text-xs ${embedded ? "bg-background/20" : "rounded-md border border-border/60 bg-gray-200 dark:bg-black/95"}`}
      >
        <summary className={`flex flex-wrap cursor-pointer list-none items-center gap-1.5 py-2 text-[11px] text-muted-foreground [&::-webkit-details-marker]:hidden ${embedded ? "px-3" : "px-2 dark:text-zinc-300"}`}>
          <CallChip icon="terminal" name="CLI" argument={(tt as Record<string, any>).serverConsole ?? "Consola del servidor"} status={status} showTimer={false} size={27} surfaceColor="var(--muted)" color="var(--muted-foreground)" className="lxp-tool-call-chip" />
          <span className="ml-auto flex items-center gap-1.5 text-[10px] opacity-80">
            {!t.result
              ? turn.stopped
                ? tt.stopped
                : cliStartedAt
                  ? <CliTimer startedAt={cliStartedAt} />
                  : tt.running
              : t.result.success ? tt.viewHistory : tt.withWarnings}
            <i className="ti ti-chevron-right transition-transform group-open:rotate-90" aria-hidden></i>
          </span>
          {attention}
        </summary>
        <div className={`border-t border-border/60 p-1 ${embedded ? "bg-gray-200 dark:bg-black/95" : ""}`}>
          <CliTerminalView bare output={t.terminal ?? ""} lanes={t.lanes} laneOrder={t.laneOrder} running={running} />
          {t.result && !t.result.success && (
            <p className="mt-1 px-1 text-[10px] text-amber-500">{t.result.output}</p>
          )}
        </div>
        {children}
      </details>
    );
  }

  return (
    <details className={`group text-xs ${embedded ? "bg-background/20" : "rounded-md bg-background/50 border border-border/60"}`}>
      <summary className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden py-2 flex flex-wrap items-center gap-1.5 ${embedded ? "px-3" : "px-2"}`}>
        {/* Estado del bloque: EN EJECUCIÓN → spinner (mismo `ti-loader-2 animate-spin`
            que el modo avanzado, también en modo simple para que el comando/tool en
            curso siempre indique que está corriendo); detenido → stop; done → check;
            error → x. La etiqueta humanizada se conserva aparte (ver abajo). */}
        <CallChip icon={icon} name={human ? human.label : t.name} argument={statusLabel} status={status} showTimer={false} size={27} surfaceColor="var(--muted)" color="var(--muted-foreground)" className="lxp-tool-call-chip" />
        {/* Disclosure arrow pinned to the right corner; rotates when expanded. */}
        <i className="ti ti-chevron-right ml-auto text-muted-foreground transition-transform group-open:rotate-90" aria-hidden></i>
        {attention}
      </summary>
      <div className="border-t border-border/60 px-2 py-1 space-y-1">
        <pre className="bg-card/60 rounded p-1.5 text-[11px] overflow-x-auto">{JSON.stringify(t.input, null, 2)}</pre>
        {t.result && <pre className="bg-card/60 rounded p-1.5 text-[11px] overflow-x-auto max-h-60">{t.result.output}</pre>}
      </div>
      {children}
    </details>
  );
}

/**
 * Collapsed "Consola del servidor" box for a CLI answer reloaded from history.
 * The live xterm trace + its raw ANSI buffer are gone on reload, so we render
 * the persisted execution log (`cliHistoryLog`) in a lightweight terminal-styled
 * <pre> (no xterm — cheap per history turn). Collapsed by default so the bubble
 * stays compact; the user expands it to read the full execution history. A
 * maximize button (and clicking the box) opens a full-screen scrollable modal.
 */
export function CliHistoryView({ text, embedded = false, children, attention }: { text: string; embedded?: boolean } & ExecutionContentProps) {
  const tt = useAssistantI18n().chatTab.toolTrace;
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const [expanded, setExpanded] = useState(false);
  return (
    <details className={`group text-xs ${embedded ? "bg-background/20" : "rounded-md border border-border/60 bg-black/95"}`}>
      <summary className={`flex flex-wrap cursor-pointer list-none items-center gap-1.5 py-2 text-[11px] ${embedded ? "px-3 text-muted-foreground" : "px-2 text-zinc-300"}`}>
        <CallChip icon="terminal" name="CLI" argument={ct.toolTrace?.serverConsole ?? "Consola del servidor"} status="done" showTimer={false} size={27} surfaceColor="var(--muted)" color="var(--muted-foreground)" className="lxp-tool-call-chip" />
        <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-500">
          {tt.viewHistory}
          <i className="ti ti-chevron-right transition-transform group-open:rotate-90" aria-hidden></i>
        </span>
        {attention}
      </summary>
      <div className={`relative border-t border-border/60 p-1 ${embedded ? "bg-black/95" : ""}`}>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title={tt.expandFullscreen}
          aria-label={tt.expandFullscreen}
          className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-zinc-200 opacity-70 transition hover:bg-white/25 hover:opacity-100"
        >
          <i className="ti ti-arrows-maximize text-[12px]" aria-hidden></i>
        </button>
        <pre
          className="max-h-64 w-full cursor-zoom-in overflow-auto whitespace-pre-wrap break-words px-1.5 py-1 font-mono text-[11px] leading-snug text-[#e4e4e7]"
          onClick={() => setExpanded(true)}
        >
          {text}
        </pre>
      </div>
      {children}
      {expanded && (
        <CliFullscreenModal onClose={() => setExpanded(false)}>
          <pre
            className="min-h-0 w-full flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-[#e4e4e7]"
          >
            {text}
          </pre>
        </CliFullscreenModal>
      )}
    </details>
  );
}

/** Standard execution disclosure when a task/notice precedes its tool trace. */
export function ExecutionDisclosure({ children, attention, running = false, failed = false, stopped = false, source }: ExecutionContentProps & { running?: boolean; failed?: boolean; stopped?: boolean; source?: "API" }) {
  const tt = useAssistantI18n().chatTab.toolTrace;
  const statusLabel = failed ? tt.error : stopped ? tt.stopped : running ? tt.running : tt.done;
  return (
    <details data-execution-source={source} className="group bg-background/20 text-xs">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-1.5 px-3 py-2 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <CallChip icon="terminal" name={source ?? tt.viewHistory} argument={source ? tt.serverConsole : statusLabel} status={failed ? "error" : stopped ? "idle" : running ? "running" : "done"} showTimer={false} size={27} surfaceColor="var(--muted)" color="var(--muted-foreground)" className="lxp-tool-call-chip" />
        {source && <span className="ml-auto text-[10px] opacity-80">{statusLabel}</span>}
        <ChevronRight className={`${source ? "" : "ml-auto "}size-3 transition-transform group-open:rotate-90`} aria-hidden />
        {attention}
      </summary>
      {children}
    </details>
  );
}

/** Live elapsed-time counter for background CLI jobs. */
export function CliTimer({ startedAt }: { startedAt: number }) {
  const [secs, setSecs] = useState(() => Math.floor((Date.now() - startedAt) / 1000));
  useEffect(() => {
    const id = setInterval(() => setSecs(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return (
    <span className="font-mono text-[10px] tabular-nums bg-muted/80 rounded px-1 py-0.5">
      {m > 0 ? `${m}m ` : ""}{String(s).padStart(2, "0")}s
    </span>
  );
}
