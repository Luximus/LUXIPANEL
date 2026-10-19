// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useId, useRef, useState } from "react";
import { PROJECT_ICONS } from "../assistant-api";
import { LucideIcon } from "../LucideIcon";

export function ProjectIconSelect({ value, onChange, label }: {
  value: string; onChange: (value: string) => void; label: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return <div ref={root} className="relative min-w-0 text-xs" data-project-icon-select
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}
    onKeyDown={(event) => {
      if (open && event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
      }
    }}>
    <span className="text-muted-foreground">{label}</span>
    <button ref={trigger} type="button" aria-label={`${label}: ${value}`} title={value}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      onClick={() => setOpen(!open)}
      onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }}
      className="mt-1 flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <LucideIcon name={value} size={18} /><i className="ti ti-chevron-down text-xs" aria-hidden />
    </button>
    {open && <div id={listId} role="listbox" aria-label={label}
      className="absolute left-0 top-full z-50 mt-1 grid w-56 grid-cols-6 gap-1 rounded-lg border border-border bg-popover p-2 shadow-lg"
      onKeyDown={(event) => {
        const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
        const index = options.indexOf(document.activeElement as HTMLButtonElement);
        const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 6, ArrowUp: -6 };
        const delta = steps[event.key];
        const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : delta === undefined ? null : (index + delta + options.length) % options.length;
        if (next !== null) { event.preventDefault(); options[next]?.focus(); }
      }}>
      {PROJECT_ICONS.map(name => <button key={name} type="button" role="option" aria-label={name}
        aria-selected={name === value} title={name} tabIndex={name === value ? 0 : -1}
        onClick={() => { onChange(name); setOpen(false); trigger.current?.focus(); }}
        className={`flex h-8 w-8 items-center justify-center rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${name === value ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-accent"}`}>
        <LucideIcon name={name} size={16} />
      </button>)}
    </div>}
  </div>;
}
