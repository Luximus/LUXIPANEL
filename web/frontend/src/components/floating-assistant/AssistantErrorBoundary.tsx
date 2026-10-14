// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Called so the parent can offer a retry (e.g. reload config). */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle crashes inside the assistant drawer so a buggy tab
 * never unmounts the whole island (which would make the floating button vanish
 * with nothing opening). Shows the actual error on-screen — useful on mobile
 * where the dev console isn't reachable.
 */
export class AssistantErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the full stack to the console for desktop debugging.
    console.error("[assistant] render crash:", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    // NOTE: error fallback strings are hardcoded as a last-resort safety net.
    // The AssistantI18nProvider wraps this component at the drawer root so
    // here we fall back to Spanish if the locale bundle hasn't loaded yet
    // (the deep-merge in `mergeNamespaces` of the parent will replace them on
    // re-render once the locale resolves). Since this is a class component we
    // can't call useAssistantI18n() here; the strings live in
    // `assistant.assistantErrorBoundary` so a future refactor can lift the
    // body to a functional component and use the hook.
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 overflow-auto p-6 text-center">
        <i className="ti ti-alert-triangle text-3xl text-amber-500" aria-hidden="true"></i>
        <p className="text-sm font-medium text-foreground">
          El asistente tuvo un error al cargar.
        </p>
        <pre className="max-h-48 w-full max-w-md overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-left text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {error.message || String(error)}
        </pre>
        <button
          type="button"
          onClick={this.reset}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/30"
        >
          <i className="ti ti-refresh text-base" aria-hidden="true"></i>
          Reintentar
        </button>
      </div>
    );
  }
}
