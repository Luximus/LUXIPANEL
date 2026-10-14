// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Read-only code container for chat responses. Uses the same editor library
 * as the Files module (Monaco), lazy-loaded so it doesn't bloat the initial
 * bundle. Shows a header with the language + a quick copy button. Falls back
 * to a styled <pre> until Monaco mounts (and if it fails to load).
 */
import { useEffect, useRef, useState } from "react";
import { useAssistantI18n } from "./i18n";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";

const LANG_MAP: Record<string, string> = {
  js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
  py: "python", rb: "ruby", sh: "shell", bash: "shell", zsh: "shell",
  yml: "yaml", md: "markdown", dockerfile: "dockerfile", json: "json",
  html: "html", css: "css", sql: "sql", go: "go", rs: "rust", php: "php",
  java: "java", c: "c", cpp: "cpp", cs: "csharp", kt: "kotlin",
};

// ── Monaco pre-loader ───────────────────────────────────────────────────────
// Monaco is heavy. The chat starts this shared import when a conversation is
// opened or a message is sent, leaving module drawers free of the download.
// CodeBlock still starts it itself when mounted through another entry point.
//
// We start with the editor.api + main.css so the basic editor mounts; the
// language services used by LANG_MAP ship in `monaco-editor/esm/vs/basic-
// languages/...` and are pulled in lazily on first language hit (cheap —
// they share the parent chunk once Monaco is cached).
let monacoPreload: Promise<typeof import("monaco-editor")> | null = null;
function preloadMonaco() {
  if (!monacoPreload) {
    monacoPreload = (async () => {
      const m = await import("monaco-editor/esm/vs/editor/editor.api");
      await import("monaco-editor/min/vs/editor/editor.main.css");
      return m;
    })().catch((error) => { monacoPreload = null; throw error; });
  }
  return monacoPreload;
}

export { preloadMonaco };

export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const [mounted, setMounted] = useState(false);

  const language = LANG_MAP[lang.toLowerCase()] ?? (lang.toLowerCase() || "plaintext");
  const lineCount = code.split("\n").length;

  useEffect(() => {
    let editor: { dispose(): void } | null = null;
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    (async () => {
      try {
        // Share the promise started by the conversation action (or start it
        // here for code rendered outside the chat pane).
        const monaco = await preloadMonaco();
        if (cancelled || !hostRef.current) return;
        const dark = document.documentElement.classList.contains("dark");
        editor = monaco.editor.create(hostRef.current, {
          value: code,
          language,
          readOnly: true,
          theme: dark ? "vs-dark" : "vs",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: "on",
          fontSize: 12,
          renderLineHighlight: "none",
          scrollbar: { alwaysConsumeMouseWheel: false },
          automaticLayout: true,
          wordWrap: "on",
          contextmenu: false,
          folding: false,
          overviewRulerLanes: 0,
        });
        if (!cancelled) setMounted(true);
      } catch {
        /* fallback <pre> stays */
      }
    })();

    return () => {
      cancelled = true;
      editor?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bounded height: ~19px/line, min 1 line, max ~360px.
  const height = Math.min(360, Math.max(1, lineCount) * 19 + 12);

  return (
    <div className="my-2 rounded-lg border border-border overflow-hidden bg-[#1e1e1e]">
      <div className="flex items-center justify-between bg-black/40 px-2.5 py-1 text-[10px]">
        <span className="font-mono uppercase tracking-wide text-muted-foreground">{language}</span>
        <button
          type="button"
          onClick={() => void copy(code)}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
        >
          <i className={`ti ${copied ? "ti-check text-emerald-400" : "ti-copy"} text-xs`} aria-hidden></i>
          {copied ? (ct.copyDone ?? "Copiado") : (ct.copyLabel ?? "Copiar")}
        </button>
      </div>
      <div className="relative">
        <div ref={hostRef} style={{ height }} className={mounted ? "" : "hidden"} />
        {!mounted && (
          <pre className="overflow-x-auto px-3 py-2 text-[12px] leading-snug text-[#d4d4d4] font-mono">
            {code}
          </pre>
        )}
      </div>
    </div>
  );
}
