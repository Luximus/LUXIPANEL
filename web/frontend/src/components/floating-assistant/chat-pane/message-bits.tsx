// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Small message-bubble bits (pending dots, copy button, translating shimmer,
 * streaming chronometer). Extracted verbatim from the original `ChatPane.tsx`.
 */
import { useEffect, useRef, useState } from "react";
import { useAssistantI18n } from "../i18n";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";

export function PendingDot() {
  return <span className="inline-flex gap-0.5 text-muted-foreground"><span className="animate-pulse">•</span><span className="animate-pulse delay-75">•</span><span className="animate-pulse delay-150">•</span></span>;
}

/** Copy-to-clipboard button for a message bubble's text. Shows a transient
    "Copiado" confirmation. `className` lets each bubble (user/assistant) match
    its own color scheme. */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const i18n = useAssistantI18n() as Record<string, any>;
  const ct = i18n.chatTab as Record<string, any>;
  const copyText = i18n.script?.copy ?? ct.copyLabel ?? "Copiar";
  const copiedText = i18n.script?.copied ?? ct.copyDone ?? "Copiado";
  const copyTitle = copyText;
  const { copied, copy } = useCopyToClipboard();
  return (
    <button
      type="button"
      onClick={() => void copy(text)}
      title={copyTitle}
      className={className ?? "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
    >
      <i className={`ti ${copied ? "ti-check text-emerald-500" : "ti-copy"} text-[12px]`} aria-hidden></i>
      {copied ? copiedText : copyText}
    </button>
  );
}

/** Background-translation transient state shown while English deltas are hidden. */
export function TranslatingShimmer({ state }: { state: "working" | "translating" }) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const label = state === "translating" ? (ct.statusTranslating ?? "Traduciendo…") : (ct.statusWorking ?? "Trabajando…");
  const icon = state === "translating" ? "ti-language" : "ti-loader-2 animate-spin";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <i className={`ti ${icon}`} aria-hidden></i>
      <span className="animate-pulse">{label}</span>
    </span>
  );
}

/**
 * Live elapsed-time counter for the header streaming indicator (C6). Starts at
 * mount (i.e. when `streaming` flips true and this component is rendered) and
 * ticks once a second. Unmounts when streaming ends, so it naturally resets for
 * the next run. `running` is accepted for API symmetry / future pausing.
 */
export function StreamTimer({ running }: { running: boolean }) {
  const startedAt = useRef(Date.now()).current;
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running, startedAt]);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return <span className="tabular-nums">{m > 0 ? `${m}m ` : ""}{s}s</span>;
}

