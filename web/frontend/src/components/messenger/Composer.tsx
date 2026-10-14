// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Message composer — autosizing textarea + attachments + send. Mirrors the AI
 * assistant composer styling. Images are downscaled with the shared
 * prepareImageForUpload helper; other files are read as base64 (capped).
 */
import { useRef, useState } from "react";
import { prepareImageForUpload, readBase64 } from "../floating-assistant/image-compress";
import { useChatI18n } from "./i18n";
import type { NewAttachment } from "./messenger-api";

/** Max decoded bytes per attachment (matches the backend 20MB base64 cap). */
const MAX_BYTES = 14 * 1024 * 1024;
const MAX_FILES = 10;

export function Composer({
  disabled,
  onSend,
  enterSends = true,
}: {
  disabled?: boolean;
  onSend: (body: string, attachments: NewAttachment[]) => Promise<void> | void;
  /** Bloque E (`prefs.general.enterSends`). When false, Enter inserts a line
   *  break and the message is sent with Ctrl/⌘ + Enter. */
  enterSends?: boolean;
}) {
  const t = useChatI18n();
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<NewAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function autosize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }

  async function addFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const next: NewAttachment[] = [];
    for (const file of Array.from(files)) {
      if (attachments.length + next.length >= MAX_FILES) break;
      try {
        if ((file.type || "").startsWith("image/")) {
          const prepared = await prepareImageForUpload(file);
          if (prepared.bytes <= MAX_BYTES) {
            next.push({ name: prepared.name, mimeType: prepared.mimeType, dataBase64: prepared.dataBase64 });
          }
        } else {
          if (file.size > MAX_BYTES) continue;
          const dataBase64 = await readBase64(file);
          next.push({ name: file.name, mimeType: file.type || "application/octet-stream", dataBase64 });
        }
      } catch {
        /* skip unreadable file */
      }
    }
    if (next.length) setAttachments((prev) => [...prev, ...next].slice(0, MAX_FILES));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    const body = draft.trim();
    if ((!body && attachments.length === 0) || busy || disabled) return;
    setBusy(true);
    try {
      await onSend(body, attachments);
      setDraft("");
      setAttachments([]);
      requestAnimationFrame(autosize);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-2 border-t border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
            >
              <i className={`ti ${a.mimeType.startsWith("image/") ? "ti-photo" : "ti-paperclip"}`} />
              <span className="max-w-[10rem] truncate">{a.name}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
              >
                <i className="ti ti-x" />
              </button>
            </span>
          ))}
        </div>
      )}
      {!enterSends && (
        <p className="px-1 text-[10px] text-muted-foreground">{t.settings.general.enterSendsHint}</p>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void addFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={disabled || attachments.length >= MAX_FILES}
          onClick={() => fileRef.current?.click()}
          title={t.attach}
          className="shrink-0 inline-flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          <i className="ti ti-paperclip text-lg" />
        </button>
        <textarea
          ref={textareaRef}
          value={draft}
          rows={1}
          disabled={disabled}
          placeholder={t.composerPlaceholder}
          onChange={(e) => {
            setDraft(e.target.value);
            autosize();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const withModifier = e.ctrlKey || e.metaKey;
            if (enterSends ? !e.shiftKey && !withModifier : withModifier) {
              e.preventDefault();
              void submit();
            }
          }}
          className="min-h-[42px] max-h-40 min-w-0 flex-1 resize-none overflow-y-auto rounded-lg border border-input bg-background px-3 py-2 text-base sm:text-sm leading-snug placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={busy || disabled || (!draft.trim() && attachments.length === 0)}
          title={t.send}
          className="shrink-0 inline-flex h-[42px] w-[42px] items-center justify-center rounded-lg bg-primary text-base text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <i className={`ti ${busy ? "ti-loader-2 animate-spin" : "ti-send"}`} />
        </button>
      </div>
    </form>
  );
}
