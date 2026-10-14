// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

interface LogoutOptions {
  label: string;
  url: string;
  csrfToken: () => string;
  csrfHeader: string;
  target: string;
}

const boundButtons = new WeakSet<HTMLElement>();
const LOGOUT_WAIT_MS = 8000;

function showLogoutScreen(label: string): void {
  const screen = document.createElement("dialog");
  screen.id = "logout-screen";
  screen.className = "lxp-logout-screen";
  screen.setAttribute("aria-label", label);
  screen.setAttribute("aria-busy", "true");
  screen.tabIndex = -1;

  const style = document.createElement("style");
  style.textContent = `
    .lxp-logout-screen {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: 100vw; height: 100dvh; max-width: none; max-height: none; box-sizing: border-box;
      gap: 24px; margin: 0; padding: 24px; border: 0; border-radius: 0; box-shadow: none;
      background: var(--background); color: var(--foreground);
      text-align: center; outline: none;
    }
    .lxp-logout-screen p { margin: 0; font: inherit; font-size: 20px; font-weight: 600; }
    .lxp-logout-spinner {
      display: block; width: 48px; height: 48px; box-sizing: border-box;
      border: 3px solid var(--border); border-top-color: var(--primary);
      border-radius: 50%; animation: lxp-logout-spin 0.8s linear infinite;
    }
    @keyframes lxp-logout-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .lxp-logout-spinner { animation: none; } }
  `;
  const spinner = document.createElement("span");
  spinner.className = "lxp-logout-spinner";
  spinner.setAttribute("aria-hidden", "true");
  const message = document.createElement("p");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  message.textContent = label;
  screen.append(style, spinner, message);

  // Keep the previous workspace out of keyboard and assistive navigation.
  for (const child of Array.from(document.body.children)) {
    if (child instanceof HTMLElement) child.inert = true;
  }
  document.body.append(screen);
  screen.addEventListener("cancel", event => event.preventDefault());
  screen.showModal();
  screen.focus();
}

export function bindLogout(button: HTMLElement | null, options: LogoutOptions): void {
  if (!button || boundButtons.has(button)) return;
  boundButtons.add(button);
  button.addEventListener("click", async () => {
    if (button.dataset.loggingOut === "true" || document.getElementById("logout-screen")) return;
    button.dataset.loggingOut = "true";
    button.setAttribute("disabled", "true");
    showLogoutScreen(options.label);
    try { window.dispatchEvent(new CustomEvent("luxipanel:logout")); } catch { /* ignore */ }

    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = fetch(options.url, {
        method: "POST",
        credentials: "include",
        headers: { [options.csrfHeader]: options.csrfToken() },
        // Let revocation finish if navigation happens after the wait limit.
        keepalive: true,
      }).catch(() => undefined);
      await Promise.race([
        request,
        new Promise<void>(resolve => { waitTimer = setTimeout(resolve, LOGOUT_WAIT_MS); }),
      ]);
    } finally {
      clearTimeout(waitTimer);
      window.location.assign(options.target);
    }
  });
}
