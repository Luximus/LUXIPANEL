// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * The per-speaker history a finished call leaves in the thread.
 *
 * One line per utterance: who said it (avatar + DISPLAY NAME — never a login),
 * when, what they said IN THEIR OWN LANGUAGE, and underneath the translation
 * into the reader's call language (`chat-prefs.calls.language`; the first
 * available one when that language was not produced). Every other translation
 * the pipeline made is one fold away, so a bilingual reader can check the
 * machine without the panel shouting three versions of every sentence.
 *
 * The transcript is NOT part of the thread payload: the backend strips it and
 * we fetch it the first time the panel is opened. That keeps a thread with a
 * dozen finished calls as cheap to render as one without any.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CollapseY } from "@/components/floating-assistant/chat-pane/collapse-y";
import { useChatI18n, formatChatMessage } from "../i18n";
import { initials } from "../format";
import { useCallPrefs, langBadge } from "./call-prefs";
import { messengerApi } from "../messenger-api";
import { formatOffset, pickTranslation, type ChatCallTranscript, type ChatCallTranscriptSegment } from "@/lib/chat-call";

/** Everything a speaker filter needs, whether or not the backend listed them. */
function speakersOf(data: ChatCallTranscript): Array<{ username: string; displayName: string }> {
  if (data.participants.length) return data.participants;
  const seen = new Map<string, string>();
  for (const s of data.segments) if (!seen.has(s.participantId)) seen.set(s.participantId, s.displayName);
  return [...seen].map(([username, displayName]) => ({ username, displayName }));
}

/** Plain-text rendering used by the copy button (what you see is what you copy). */
function toPlainText(segments: ChatCallTranscriptSegment[], readerLang: string): string {
  return segments
    .map((s) => {
      const tr = pickTranslation(s, readerLang);
      const head = `[${formatOffset(s.startMs)}] ${s.displayName} (${langBadge(s.lang) || "?"}): ${s.text}`;
      return tr ? `${head}\n    → (${langBadge(tr.lang)}) ${tr.text}` : head;
    })
    .join("\n");
}

export function CallTranscriptPanel({
  convId,
  messageId,
  open,
}: {
  convId: string;
  messageId: string;
  open: boolean;
}) {
  const t = useChatI18n();
  const readerLang = useCallPrefs().language;
  const [data, setData] = useState<ChatCallTranscript | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [speaker, setSpeaker] = useState<string>("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  // Fetch exactly once per mount, on the first open — a fold-close must not
  // throw the transcript away and re-download it on the next click.
  const requested = useRef(false);

  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    setLoading(true);
    let alive = true;
    messengerApi
      .getCallTranscript(convId, messageId)
      .then((res) => {
        if (!alive) return;
        setData(res);
        setFailed(false);
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, convId, messageId]);

  const speakers = useMemo(() => (data ? speakersOf(data) : []), [data]);
  const visible = useMemo(
    () => (data ? data.segments.filter((s) => !speaker || s.participantId === speaker) : []),
    [data, speaker],
  );

  const onCopy = useCallback(() => {
    const text = toPlainText(visible, readerLang);
    // `writeText` rejects on an insecure origin or a denied permission; the
    // button simply does not flash "copiado" then.
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1_600);
      },
      () => setCopied(false),
    );
  }, [visible, readerLang]);

  return (
    <CollapseY open={open}>
      <div className="mt-1.5 w-full rounded-xl border border-border bg-background/60 p-2 text-left">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground">{t.call.transcript.title}</span>
          {data && data.segments.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {formatChatMessage(t.call.transcript.segments, { count: data.segments.length })}
            </span>
          )}
          <span className="flex-1" />
          {speakers.length > 1 && (
            <select
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              aria-label={t.call.transcript.filterLabel}
              title={t.call.transcript.filterLabel}
              className="rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px] text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">{t.call.transcript.allSpeakers}</option>
              {speakers.map((p) => (
                // The VALUE is the login (the join key); the LABEL is the human name.
                <option key={p.username} value={p.username}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}
          {visible.length > 0 && (
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <i className={`ti ${copied ? "ti-check" : "ti-copy"}`} aria-hidden />
              {copied ? t.call.transcript.copied : t.call.transcript.copy}
            </button>
          )}
        </div>

        {data?.truncated && (
          <p className="mb-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-400">
            {t.call.transcript.truncated}
          </p>
        )}

        {loading && <p className="py-2 text-center text-[11px] text-muted-foreground">{t.call.transcript.loading}</p>}
        {!loading && failed && (
          <p className="py-2 text-center text-[11px] text-destructive">{t.call.transcript.error}</p>
        )}
        {!loading && !failed && visible.length === 0 && (
          <p className="py-2 text-center text-[11px] text-muted-foreground">{t.call.transcript.empty}</p>
        )}

        <ul className="flex flex-col gap-2">
          {visible.map((s) => {
            const translation = pickTranslation(s, readerLang);
            const others = Object.entries(s.translations).filter(([lang]) => lang !== translation?.lang);
            const isOpen = !!expanded[s.seq];
            return (
              <li key={`${s.seq}-${s.startMs}`} className="flex gap-2">
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary"
                  title={s.displayName}
                >
                  {initials(s.displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-[11px] font-medium text-foreground">{s.displayName}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground/80">{formatOffset(s.startMs)}</span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-1.5 text-[12px] text-foreground">
                    <span className="rounded bg-muted px-1 text-[9px] font-semibold uppercase text-muted-foreground">
                      {langBadge(s.lang) || "?"}
                    </span>
                    <span className="min-w-0 break-words">{s.text}</span>
                  </p>
                  {translation && (
                    <p className="mt-0.5 flex flex-wrap items-baseline gap-1.5 border-l-2 border-primary/30 pl-1.5 text-[12px] text-muted-foreground">
                      <span className="rounded bg-primary/10 px-1 text-[9px] font-semibold uppercase text-primary">
                        {langBadge(translation.lang)}
                      </span>
                      <span className="min-w-0 break-words">{translation.text}</span>
                    </p>
                  )}
                  {others.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [s.seq]: !prev[s.seq] }))}
                        aria-expanded={isOpen}
                        className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        <i className={`ti ${isOpen ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden />
                        {t.call.transcript.otherTranslations}
                      </button>
                      <CollapseY open={isOpen}>
                        <ul className="mt-0.5 flex flex-col gap-0.5">
                          {others.map(([lang, text]) => (
                            <li key={lang} className="flex flex-wrap items-baseline gap-1.5 text-[11px] text-muted-foreground">
                              <span className="rounded bg-muted px-1 text-[9px] font-semibold uppercase">{langBadge(lang)}</span>
                              <span className="min-w-0 break-words">{text}</span>
                            </li>
                          ))}
                        </ul>
                      </CollapseY>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </CollapseY>
  );
}
