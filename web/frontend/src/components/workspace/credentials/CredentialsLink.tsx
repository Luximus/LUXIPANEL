import type { MouseEvent } from "react";

/** Every integration points at the same editor; switching drawers stays local. */
export function CredentialsLink({ label, credential = "assistant" }: { label: string; credential?: string }) {
  const href = `/panel/settings#cred-${encodeURIComponent(credential)}`;
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    window.dispatchEvent(new Event("luxipanel:credentials-open"));
    if (window.__lxpInternalModules?.open(href)) event.preventDefault();
  }
  return <a href={href} onClick={open} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary hover:bg-accent">
    <i className="ti ti-key" aria-hidden />{label}
  </a>;
}
