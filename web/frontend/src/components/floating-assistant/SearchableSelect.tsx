// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Lightweight single-select combobox used by /panel/assistant > Stats filters.
 *
 * Built on plain React + Tailwind instead of pulling in `@base-ui/react`'s
 * Combobox (which is overkill for these handful of options): a text input
 * filters the list, click an item to select, Escape or click-outside closes
 * the popover, the selected label renders inside the trigger when collapsed.
 *
 * Props mirror the contract the stats filters need:
 *  - `value`          : currently selected id ("" = none)
 *  - `onChange(value)` : selected id changes (always a string; "" cleared)
 *  - `options`        : `{ id: string; label: string }[]`
 *  - `placeholder`    : shown in the trigger when nothing is selected
 *  - `searchAriaLabel`: aria-label for the internal text search input
 *  - `noMatchesLabel` : empty-state text inside the popover
 *  - `clearLabel`     : aria-label for the "clear" X button
 *  - `disabled`       : greys out + blocks interaction
 *
 * Selecting an item collapses the popover and puts the focused-class ring
 * away so the parent looks like a normal filter that has "chosen" something.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";

export interface SearchableSelectOption {
  id: string;
  label: string;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchAriaLabel: string;
  noMatchesLabel: string;
  clearLabel: string;
  disabled?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchAriaLabel,
  noMatchesLabel,
  clearLabel,
  disabled,
}: SearchableSelectProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedLabel = useMemo(
    () => options.find((o) => o.id === value)?.label ?? "",
    [options, value],
  );

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    function onDocClick(ev: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Focus the search input when the popover opens so the user can just type.
  useEffect(() => {
    if (open) {
      // Run after the popup mounts.
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    setQuery("");
    return undefined;
  }, [open]);

  function commit(id: string) {
    onChange(id);
    setOpen(false);
  }

  function onKeyDown(ev: KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      setOpen(false);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const first = filtered[0];
      if (first) commit(first.id);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`mt-1 flex h-8 w-full items-center justify-between gap-1 rounded-md border bg-background px-2 text-left text-xs transition-colors focus:outline-none ${
          disabled
            ? "cursor-not-allowed border-input opacity-60"
            : open
              ? "border-primary"
              : "border-input hover:border-primary/50 focus:border-primary"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate ${selectedLabel ? "text-foreground" : "text-muted-foreground"}`}>
          {selectedLabel || placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selectedLabel && !disabled && (
            <span
              role="button"
              aria-label={clearLabel}
              title={clearLabel}
              tabIndex={-1}
              onClick={(ev) => {
                ev.stopPropagation();
                onChange("");
              }}
              className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <i className="ti ti-x text-[11px]" aria-hidden></i>
            </span>
          )}
          <i
            aria-hidden
            className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"} text-[10px] text-muted-foreground`}
          ></i>
        </span>
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
          role="dialog"
        >
          <div className="border-b border-border/60 p-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label={searchAriaLabel}
              placeholder={searchAriaLabel}
              className="h-7 w-full rounded-sm border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            className="max-h-56 overflow-y-auto py-1 text-xs"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-center text-[11px] text-muted-foreground">
                {noMatchesLabel}
              </li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt.id}
                  role="option"
                  aria-selected={opt.id === value}
                  onClick={() => commit(opt.id)}
                  className={`flex cursor-pointer items-center justify-between gap-2 px-2 py-1.5 hover:bg-accent ${
                    opt.id === value ? "bg-primary/10 text-foreground" : "text-foreground/80"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.id === value && (
                    <i aria-hidden className="ti ti-check shrink-0 text-[11px] text-primary"></i>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
