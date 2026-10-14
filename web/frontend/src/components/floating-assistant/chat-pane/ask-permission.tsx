// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Interactive turn affordances: CLI ask (single/multi/text), live permission
 * prompt, and the compaction divider. Extracted verbatim from `ChatPane.tsx`.
 */
import { useState } from "react";
import { useAssistantI18n, formatAssistantMessage } from "../i18n";
import { type AskQuestion } from "../assistant-api";
import { type ChatTurn } from "../chat-engine";
import { MessageContent } from "../MessageContent";

/**
 * Interactive controls for a question the CLI agent posed (single / multi /
 * text). Rendered on the LAST assistant turn that carries `ask`. On submit it
 * composes a readable answer and hands it to `onAnswer`, which sends it as the
 * next turn — resuming the upstream session with the user's choice. Older
 * (already-answered) turns render a muted, static recap instead.
 */
export function AskView({
  questions,
  kind,
  interactive,
  onAnswer,
}: {
  questions: AskQuestion[];
  /** "plan-approval" → responder con la PRIMERA opción envía planDecision:"approve". */
  kind?: "plan-approval";
  interactive: boolean;
  onAnswer: (text: string, opts?: { planDecision?: "approve" }) => Promise<void> | void;
}) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const [single, setSingle] = useState<Record<string, string>>({});
  const [multi, setMulti] = useState<Record<string, string[]>>({});
  const [textVal, setTextVal] = useState<Record<string, string>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(false);

  /** Resolve the chosen value(s) for one question (free-text "otro" wins/joins). */
  function valueFor(q: AskQuestion): string[] {
    const extra = (other[q.id] ?? "").trim();
    if (q.type === "text") return [(textVal[q.id] ?? "").trim()].filter(Boolean);
    if (q.type === "multi") {
      const base = multi[q.id] ?? [];
      return extra ? [...base, extra] : base;
    }
    const sel = extra ? extra : (single[q.id] ?? "");
    return sel ? [sel] : [];
  }

  // multi can be legitimately empty ("ninguno"); single/text must have a value.
  const allAnswered = questions.every((q) => q.type === "multi" || valueFor(q).length > 0);

  function submit(approvedChoice?: string) {
    if (!interactive || sent || (!allAnswered && !approvedChoice)) return;
    const first = questions[0];
    const body =
      questions.length === 1 && first
        ? approvedChoice ?? valueFor(first).join(", ")
        : `Respuestas:\n${questions.map((q) => `- ${q.text}: ${valueFor(q).join(", ") || "(ninguno)"}`).join("\n")}`;
    if (!body.trim()) return;
    // Aprobación de plan: solo cuenta elegir la PRIMERA opción con el botón
    // (sin texto libre) — el flag estructurado sobrevive a la traducción,
    // el texto no. Cualquier otra elección viaja como respuesta normal.
    const approved =
      kind === "plan-approval" &&
      questions.length === 1 &&
      first?.type === "single" &&
      (approvedChoice === first.options?.[0] ||
        (!(other[first.id] ?? "").trim() && (single[first.id] ?? "") === first.options?.[0])) &&
      !!first.options?.[0];
    setSent(true);
    setSendError(false);
    void Promise.resolve()
      .then(() => onAnswer(body, approved ? { planDecision: "approve" } : undefined))
      .catch(() => { setSent(false); setSendError(true); });
  }

  // Static recap once it's no longer the active turn (we don't store the choice).
  if (!interactive) {
    return (
      <div className="mt-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-1.5 font-medium text-foreground/80">
          <i className="ti ti-help-circle shrink-0" aria-hidden></i>
          {questions.length === 1 ? (ct.askedQuestionOne ?? "El asistente hizo una pregunta") : formatAssistantMessage(ct.askedQuestionMany ?? "El asistente hizo {count} preguntas", { count: questions.length })}
        </p>
        {questions.map((q) => (
          <p key={q.id} className="pl-5">• {q.text}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-2.5 space-y-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <i className="ti ti-help-circle shrink-0 text-primary" aria-hidden></i>
        {ct.needsDecision ?? "El asistente necesita tu decisión para continuar"}
      </p>

      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <p className="text-xs font-medium text-foreground/90">{q.text}</p>

          {q.type === "text" ? (
            <input
              type="text"
              value={textVal[q.id] ?? ""}
              onChange={(e) => setTextVal((s) => ({ ...s, [q.id]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              placeholder={ct.answerPlaceholder ?? "Escribe tu respuesta…"}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(q.options ?? []).map((opt) => {
                  const selected =
                    q.type === "multi"
                      ? (multi[q.id] ?? []).includes(opt)
                      : (single[q.id] ?? "") === opt && !(other[q.id] ?? "").trim();
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        if (q.type === "multi") {
                          setMulti((s) => {
                            const cur = s[q.id] ?? [];
                            return { ...s, [q.id]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt] };
                          });
                        } else {
                          setSingle((s) => ({ ...s, [q.id]: opt }));
                          setOther((s) => ({ ...s, [q.id]: "" }));
                          if (kind === "plan-approval" && questions.length === 1 && opt === q.options?.[0]) {
                            submit(opt);
                          }
                        }
                      }}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {q.type === "multi" && (
                        <i className={`ti ${selected ? "ti-checkbox" : "ti-square"} text-[13px]`} aria-hidden></i>
                      )}
                      {opt}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={other[q.id] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setOther((s) => ({ ...s, [q.id]: v }));
                  if (q.type !== "multi" && v.trim()) setSingle((s) => ({ ...s, [q.id]: "" }));
                }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
                placeholder={ct.otherAnswerPlaceholder ?? "Otra respuesta…"}
                className="w-full rounded-md border border-dashed border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => submit()}
        disabled={!allAnswered || sent}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition enabled:hover:opacity-90 disabled:opacity-50"
      >
        <i className={`ti ${sent ? "ti-loader-2 animate-spin" : "ti-send"}`} aria-hidden></i>
        {sent ? (ct.askSending ?? "Enviando…") : (ct.askRespond ?? "Responder")}
      </button>
      {sendError && <p role="alert" className="text-xs text-destructive">{ct.answerFailed ?? "No se pudo completar la respuesta"}</p>}
    </div>
  );
}

/**
 * Live permission prompt: the Claude CLI wants to run a mutating tool and is
 * blocked awaiting the user. Approve → the action runs and the turn continues;
 * Reject → the agent backs off. The decision is POSTed mid-run (no new message).
 * Replaces the old `--dangerously-skip-permissions` autonomy.
 */
export function PermissionView({
  request,
  interactive,
  onDecide,
}: {
  request: { id: string; tool: string; title: string; detail?: string };
  interactive: boolean;
  onDecide: (decision: "allow" | "deny" | "always") => void;
}) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const [sent, setSent] = useState<"allow" | "deny" | "always" | null>(null);

  function decide(decision: "allow" | "deny" | "always") {
    if (sent) return;
    setSent(decision);
    onDecide(decision);
  }

  // Once it's no longer the active turn (run stopped / superseded) we don't have
  // the stored choice — show a muted recap so the bubble isn't confusing.
  if (!interactive) {
    return (
      <div className="mt-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-1.5 font-medium text-foreground/80">
          <i className="ti ti-shield-lock shrink-0" aria-hidden></i>
          {ct.permRequestedPrefix ?? "El asistente pidió permiso para:"} {request.title}
        </p>
        {request.detail ? <p className="pl-5 break-all font-mono text-[11px]">{request.detail}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-2.5 py-2.5 space-y-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <i className="ti ti-shield-lock shrink-0 text-amber-500" aria-hidden></i>
        {ct.permNeedsApproval ?? "El asistente necesita tu permiso para continuar"}
      </p>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground/90">{request.title}</p>
        {request.detail ? (
          <pre className="max-h-40 overflow-auto rounded-md border border-border bg-background px-2 py-1.5 text-[11px] leading-snug whitespace-pre-wrap break-all font-mono">
            {request.detail}
          </pre>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          {ct.permToolLabel ?? "Herramienta:"} <span className="font-mono">{request.tool}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decide("allow")}
          disabled={!!sent}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition enabled:hover:opacity-90 disabled:opacity-50"
        >
          <i className={`ti ${sent === "allow" ? "ti-loader-2 animate-spin" : "ti-check"}`} aria-hidden></i>
          {ct.permApprove ?? "Aprobar"}
        </button>
        <button
          type="button"
          onClick={() => decide("always")}
          disabled={!!sent}
          title={formatAssistantMessage(ct.permApproveAlwaysTitle ?? "Aprobar y no volver a preguntar para la herramienta \"{tool}\". Se guardará para futuras tareas.", { tool: request.tool })}
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 transition enabled:hover:bg-emerald-500/20 disabled:opacity-50"
        >
          <i className={`ti ${sent === "always" ? "ti-loader-2 animate-spin" : "ti-checks"}`} aria-hidden></i>
          {ct.permApproveAlways ?? "Aprobar y no preguntar más"}
        </button>
        <button
          type="button"
          onClick={() => decide("deny")}
          disabled={!!sent}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition enabled:hover:bg-muted disabled:opacity-50"
        >
          <i className={`ti ${sent === "deny" ? "ti-loader-2 animate-spin" : "ti-x"}`} aria-hidden></i>
          {ct.permDeny ?? "Rechazar"}
        </button>
      </div>
    </div>
  );
}

/** Divider shown in place of the turns that a context compaction folded. Click
 *  to expand the summary the model now sees instead of those older messages. */
export function CompactionDivider({ turn }: { turn: ChatTurn }) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const [open, setOpen] = useState(false);
  const n = turn.summarizedCount ?? 0;
  // Strip our own "[Resumen…]" prefix; the divider label already conveys it.
  // Defensive: a malformed compaction can land an undefined text; treat as empty
  // so the divider doesn't crash the whole chat with a .replace TypeError.
  const body = (typeof turn.text === "string" ? turn.text : "").replace(
    /^\[Resumen de la conversación previa[^\]]*\]\s*/i,
    "",
  );
  return (
    <div className="my-2 flex flex-col items-stretch">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-[11px] text-muted-foreground/80 hover:text-muted-foreground"
        aria-expanded={open}
      >
        <span className="h-px flex-1 bg-border" />
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5">
          <i className="ti ti-arrows-minimize text-[11px]" aria-hidden></i>
          {n > 0 ? formatAssistantMessage(ct.summarizedMessages ?? "{count} mensajes anteriores resumidos", { count: n }) : (ct.conversationCompacted ?? "Conversación compactada")}
          <i className={`ti ti-chevron-down text-[11px] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden></i>
        </span>
        <span className="h-px flex-1 bg-border" />
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <MessageContent text={body} />
        </div>
      )}
    </div>
  );
}
