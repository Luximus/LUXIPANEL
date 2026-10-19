// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * DirectoryPicker — browse the CONNECTED server's filesystem and pick a
 * directory. Mirrors the path-browser pattern used elsewhere in the panel
 * (Users role paths, Backups, Cron): lists `/api/files/list?path=`, filters to
 * directories, lets you navigate up/into folders, and returns the chosen path.
 *
 * Portaled to <body> and stacked above the ProjectModal (which is also a body
 * portal). Pointer events are stopped so the assistant drawer underneath never
 * reads a click here as an outside dismiss.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { ModalShell } from "@/components/ui/ModalShell";
import { useAssistantI18n, mergeNamespaces } from "./i18n";

interface DirectoryPickerMessages {
  title: string;
  goUp: string;
  loading: string;
  emptyDirs: string;
  cancel: string;
  select: string;
  readError: string;
}

// Type-only fallback string shape; actual strings live in the i18n locale files
// (assistant.directoryPicker.*) and are deep-merged at runtime via mergeNamespaces.
const directoryPickerFallback: DirectoryPickerMessages = {
  title: "",
  goUp: "",
  loading: "",
  emptyDirs: "",
  cancel: "",
  select: "",
  readError: "",
};

interface DirEntry {
  name: string;
  path: string;
  isDir?: boolean;
  type?: string;
}

interface DirectoryPickerProps {
  initialPath?: string;
  onClose(): void;
  onSelect(path: string): void;
}

function parentOf(p: string): string {
  const trimmed = p.replace(/\/+$/, "");
  if (!trimmed || trimmed === "") return "/";
  const idx = trimmed.lastIndexOf("/");
  return idx <= 0 ? "/" : trimmed.slice(0, idx);
}

export function DirectoryPicker({ initialPath = "/", onClose, onSelect }: DirectoryPickerProps) {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    directoryPicker?: Partial<DirectoryPickerMessages>;
  };
  const tt = mergeNamespaces(directoryPickerFallback, i18n.directoryPicker);

  const [cwd, setCwd] = useState(initialPath || "/");
  const [dirs, setDirs] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .get<DirEntry[]>(`/api/files/list?path=${encodeURIComponent(cwd)}`)
      .then((res) => {
        if (!alive) return;
        if (!res.ok) {
          setError(res.error ?? tt.readError);
          setDirs([]);
          return;
        }
        const data = Array.isArray(res.data) ? res.data : [];
        setDirs(data.filter((e) => e.isDir || e.type === "dir"));
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [cwd]);

  // Stacked above the ProjectModal drawer via z-[10000].
  return (
    <ModalShell
      onClose={onClose}
      zIndexClass="z-[10000]"
      title={tt.title}
      closeLabel={i18n.drawer.close}
      cardClassName="max-sm:pb-[env(safe-area-inset-bottom)]"
      bodyClassName="flex min-h-0 flex-col gap-3 overflow-hidden p-3 sm:p-4"
      footer={
        <>
          <button type="button" onClick={onClose} className="min-h-11 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
            {tt.cancel}
          </button>
          <button
            type="button"
            onClick={() => onSelect(cwd)}
            className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {tt.select}
          </button>
        </>
      }
    >
        <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setCwd(parentOf(cwd))}
              disabled={cwd === "/" || loading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent disabled:opacity-40"
              title={tt.goUp}
            >
              <i className="ti ti-arrow-up" aria-hidden></i>
            </button>
            <code className="min-w-0 flex-1 break-all rounded-md bg-muted/50 px-3 py-2 font-mono text-xs leading-5" title={cwd}>
              {cwd}
            </code>
          </div>

          {error && <p className="shrink-0 rounded-md bg-red-500/10 px-2 py-1.5 text-[11px] text-red-500">⚠ {error}</p>}

          <ul className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border/50 bg-muted/20 p-1" data-directory-list>
            {loading ? (
              <li className="px-3 py-3 text-center text-xs text-muted-foreground">
                <i className="ti ti-loader-2 animate-spin mr-1" aria-hidden></i>{tt.loading}
              </li>
            ) : dirs.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-muted-foreground">{tt.emptyDirs}</li>
            ) : (
              dirs.map((d) => (
                <li key={d.path}>
                  <button
                    type="button"
                    onClick={() => setCwd(d.path)}
                    className="flex min-h-11 w-full items-center gap-3 rounded px-3 py-2 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <i className="ti ti-folder text-amber-500" aria-hidden></i>
                    <span className="truncate">{d.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
    </ModalShell>
  );
}
