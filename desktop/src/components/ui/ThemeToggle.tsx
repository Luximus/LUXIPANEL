import type { MouseEvent as ReactMouseEvent } from "react";
import type { ThemeMode } from "../../features/app/types";

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void) => unknown;
};

// Theme toggle with a circular reveal transition (theme-toggle.rdsx.dev pattern).
// Uses the View Transitions API + clip-path keyframes; falls back to a plain
// state change when the API isn't available.
export function ThemeToggle({ theme, onToggle, label }: { theme: ThemeMode; onToggle: () => void; label?: string }) {
  const isDark = theme === "dark";
  const a11yLabel = label ?? "Cambiar tema";

  function handleClick(event: ReactMouseEvent<HTMLLabelElement>) {
    event.preventDefault();
    const root = document.documentElement;
    root.style.setProperty("--theme-x", `${event.clientX}px`);
    root.style.setProperty("--theme-y", `${event.clientY}px`);

    const doc = document as ViewTransitionDocument;
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => onToggle());
    } else {
      onToggle();
    }
  }

  return (
    <label
      className={`lp-theme-toggle tooltip tooltip-bottom ${isDark ? "is-dark" : "is-light"}`}
      data-tip={a11yLabel}
      aria-label={a11yLabel}
      onClick={handleClick}
    >
      <input type="checkbox" checked={isDark} readOnly tabIndex={-1} />
      <span className="lp-theme-toggle__track" aria-hidden="true">
        <svg
          className="lp-theme-toggle__icon lp-theme-toggle__icon--sun"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
        >
          <g strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2"></path>
            <path d="M12 20v2"></path>
            <path d="m4.93 4.93 1.41 1.41"></path>
            <path d="m17.66 17.66 1.41 1.41"></path>
            <path d="M2 12h2"></path>
            <path d="M20 12h2"></path>
            <path d="m6.34 17.66-1.41 1.41"></path>
            <path d="m19.07 4.93-1.41 1.41"></path>
          </g>
        </svg>
        <svg
          className="lp-theme-toggle__icon lp-theme-toggle__icon--moon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
        >
          <g strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
          </g>
        </svg>
        <span className="lp-theme-toggle__thumb"></span>
      </span>
    </label>
  );
}
