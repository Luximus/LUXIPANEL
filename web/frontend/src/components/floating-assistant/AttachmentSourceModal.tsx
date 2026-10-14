// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useMemo, useRef, useState } from "react";
import { DIALOG_CHROME } from "@/lib/ui-classes";
import { api, resolvePanelApiPath, scopeHeaders } from "@/lib/api-client";
import { ModalNavbar } from "@/components/ui/ModalNavbar";
import { formatAssistantMessage, useAssistantI18n } from "./i18n";

interface AttachmentSupportLike {
  acceptAttr: string;
  label: string;
  accepts(mime: string): boolean;
}

interface ServerEntry {
  name: string;
  path: string;
  isDir?: boolean;
  type?: string;
}

interface AttachmentSourceModalProps {
  open: boolean;
  support: AttachmentSupportLike;
  provider: string;
  mode: "api" | "cli";
  model?: string;
  onClose(): void;
  onPickLocal(): void;
  onAttachServerFiles(files: File[]): Promise<boolean | void>;
}

const MIME_BY_EXT: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  const ext = Object.keys(MIME_BY_EXT).find((suffix) => lower.endsWith(suffix));
  return ext ? MIME_BY_EXT[ext] : "application/octet-stream";
}

function parentOf(path: string): string {
  const trimmed = path.replace(/\/+$/, "") || "/";
  if (trimmed === "/") return "/";
  const idx = trimmed.lastIndexOf("/");
  return idx <= 0 ? "/" : trimmed.slice(0, idx);
}

export function AttachmentSourceModal({
  open,
  support,
  provider,
  mode,
  model,
  onClose,
  onPickLocal,
  onAttachServerFiles,
}: AttachmentSourceModalProps) {
  const mt = (useAssistantI18n().chatTab as Record<string, any>).attachmentModal as Record<string, string>;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [view, setView] = useState<"menu" | "server">("menu");
  const [cwd, setCwd] = useState("/");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<ServerEntry[]>([]);
  const [selected, setSelected] = useState<Record<string, { name: string; mime: string }>>({});
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      setView("menu");
      setQuery("");
      setError(null);
      setSelected({});
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  useEffect(() => {
    if (!open || view !== "server") return;
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .get<ServerEntry[]>("/api/files/list", { params: { path: cwd } })
      .then((res) => {
        if (!alive) return;
        if (!res.ok) {
          setEntries([]);
          setError(res.error ?? mt.readFolderError);
          return;
        }
        setEntries(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        if (alive) {
          setEntries([]);
          setError(err instanceof Error ? err.message : mt.readFolderError);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, view, cwd]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const items = entries.filter((entry) => entry.name !== "." && entry.name !== "..");
    if (!term) return items;
    return items.filter((entry) => entry.name.toLowerCase().includes(term) || entry.path.toLowerCase().includes(term));
  }, [entries, query]);

  const selectedCount = Object.keys(selected).length;

  function toggleSelected(path: string, name: string) {
    const mime = guessMime(name);
    if (!support.accepts(mime)) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[path]) delete next[path];
      else next[path] = { name, mime };
      return next;
    });
  }

  async function attachSelected() {
    const picks = Object.entries(selected);
    if (picks.length === 0 || attaching) return;
    setAttaching(true);
    setError(null);
    try {
      const files = await Promise.all(
        picks.map(async ([path, meta]) => {
          const response = await fetch(resolvePanelApiPath(`/api/files/download?path=${encodeURIComponent(path)}`), {
            credentials: "include",
            cache: "no-store",
            headers: scopeHeaders(),
          });
          if (!response.ok) throw new Error(formatAssistantMessage(mt.downloadFileError, { name: meta.name }));
          const blob = await response.blob();
          return new File([blob], meta.name, { type: meta.mime });
        }),
      );
      await onAttachServerFiles(files);
      dialogRef.current?.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : mt.attachSelectedError);
    } finally {
      setAttaching(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={`w-[min(96vw,54rem)] ${DIALOG_CHROME}`}
    >
      <ModalNavbar
        title={view === "menu" ? mt.titleMenu : mt.titleServer}
        description={
          view === "menu"
            ? mt.menuDescription
            : formatAssistantMessage(mt.serverDescription, { provider, modelSuffix: model ? ` (${model})` : "" })
        }
        onBack={
          view === "server"
            ? () => {
                setView("menu");
                setSelected({});
                setError(null);
              }
            : undefined
        }
        backLabel={mt.back}
        onClose={() => dialogRef.current?.close()}
        closeLabel={mt.close}
        className="px-6"
      />

      <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
        {view === "menu" ? (
          <section className="space-y-4">
            <p className="text-xs text-muted-foreground">{formatAssistantMessage(mt.allowedFormats, { formats: support.label || support.acceptAttr || provider })}</p>
            <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  onPickLocal();
                  dialogRef.current?.close();
                }}
                className="group rounded-xl border border-border bg-background p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-primary">
                  <i className="ti ti-upload text-lg" aria-hidden></i>
                </div>
                <p className="text-sm font-semibold text-foreground">{mt.fromComputerTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">{mt.fromComputerDescription}</p>
              </button>

              <button
                type="button"
                onClick={() => setView("server")}
                className="group rounded-xl border border-border bg-background p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-primary">
                  <i className="ti ti-server text-lg" aria-hidden></i>
                </div>
                <p className="text-sm font-semibold text-foreground">{mt.fromServerTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">{mt.fromServerDescription}</p>
              </button>
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCwd(parentOf(cwd))}
                  disabled={cwd === "/" || loading}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
                  title={mt.upFolder}
                >
                  <i className="ti ti-arrow-up" aria-hidden></i>
                </button>
                <code className="min-w-0 flex-1 truncate rounded-lg bg-muted/50 px-3 py-2 text-xs" title={cwd}>
                  {cwd}
                </code>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder={mt.searchPlaceholder}
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
              <div className="text-xs text-muted-foreground">
                {selectedCount > 0
                  ? formatAssistantMessage(mt.selectedCount, { count: selectedCount })
                  : formatAssistantMessage(mt.modeLabel, { mode: mode.toUpperCase() })}
              </div>
            </div>

            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}

            <div className="overflow-hidden rounded-xl border border-border bg-background">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-border/70 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>{mt.nameColumn}</span>
                <span>{mt.selectColumn}</span>
              </div>
              <div className="max-h-[22rem] overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">{mt.loading}</div>
                ) : filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">{mt.emptyFolder}</div>
                ) : (
                  filtered.map((entry) => {
                    const isDir = entry.isDir || entry.type === "dir";
                    const mime = guessMime(entry.name);
                    const supported = !isDir && support.accepts(mime);
                    return (
                      <div key={entry.path} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border/50 px-4 py-2 last:border-b-0">
                        {isDir ? (
                          <button
                            type="button"
                            onClick={() => setCwd(entry.path)}
                            className="flex min-w-0 items-center gap-2 text-left text-sm transition-colors hover:text-primary"
                          >
                            <i className="ti ti-folder text-amber-500" aria-hidden></i>
                            <span className="truncate">{entry.name}</span>
                          </button>
                        ) : (
                          <div className="flex min-w-0 items-center gap-2 text-sm">
                            <i className={`ti ${mime.startsWith("image/") ? "ti-photo" : mime === "application/pdf" ? "ti-file-type-pdf" : "ti-file"} text-muted-foreground`} aria-hidden></i>
                            <div className="min-w-0">
                              <p className="truncate">{entry.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{supported ? mime : mt.unsupportedMime}</p>
                            </div>
                          </div>
                        )}
                        {isDir ? (
                          <button
                            type="button"
                            onClick={() => setCwd(entry.path)}
                            className="rounded-lg border border-border px-2 py-1 text-xs transition-colors hover:bg-accent"
                          >
                            {mt.open}
                          </button>
                        ) : (
                          <label className={`inline-flex items-center gap-2 text-xs ${supported ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground/60"}`}>
                            <input
                              type="checkbox"
                              checked={!!selected[entry.path]}
                              disabled={!supported}
                              onChange={() => toggleSelected(entry.path, entry.name)}
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            />
                            {mt.choose}
                          </label>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground">{view === "server" ? mt.footerServer : mt.footerMenu}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            {mt.cancel}
          </button>
          {view === "server" && (
            <button
              type="button"
              onClick={() => void attachSelected()}
              disabled={selectedCount === 0 || attaching}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {attaching ? mt.attaching : formatAssistantMessage(mt.attach, { count: selectedCount || "" })}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
