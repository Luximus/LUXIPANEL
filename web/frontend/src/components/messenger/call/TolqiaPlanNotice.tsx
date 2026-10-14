// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * The Tolqia PLAN surface of the messenger.
 *
 * Two audiences, one vocabulary:
 *
 *  • `TolqiaPlanNotice` — a discreet line inside the call overlay when Tolqia
 *    refused translation and said why (`call.translation.reason`), with a link
 *    to the pricing page. It is deliberately NOT an error: the call itself is
 *    running, only the translation is not.
 *  • `TolqiaPlanRow` — the badge in Ajustes › Llamadas: which plan this server
 *    is on, or the "you need a token" notice. Only an ADMIN sees the link to
 *    Ajustes → Credenciales; everyone else gets the sentence without a dead end.
 *
 * `tolqiaPlanMessage` is the shared mapper (reason → localized sentence) so the
 * toast in `ChatModule` and the notice here can never drift apart.
 */
import { formatChatMessage, useChatI18n, type ChatMessages } from "../i18n";
import type { ChatCallView } from "@/lib/chat-call";
import {
  tolqiaReason,
  TOLQIA_CREDENTIALS_HREF,
  TOLQIA_PRICING_URL,
  type TolqiaPlan,
  type TolqiaReason,
} from "./tolqia-plan";

/**
 * Reason → the sentence the user reads. `count` is the number of participants
 * that asked for translation (only `PLAN_LIMIT_TRANSLATION` uses it).
 * Returns null for an unknown/absent reason so callers keep their own fallback.
 */
export function tolqiaPlanMessage(
  t: ChatMessages,
  reason: TolqiaReason | null,
  count = 0,
): string | null {
  switch (reason) {
    case "PLAN_LIMIT_TRANSLATION":
      return formatChatMessage(t.call.plan.limitTranslation, { count });
    case "PLAN_INACTIVE":
      return t.call.plan.inactive;
    case "PLAN_REQUIRED":
      return t.call.plan.required;
    case "TOKEN_INVALID":
      return t.call.plan.tokenInvalid;
    default:
      return null;
  }
}

/**
 * The in-overlay notice. Renders nothing unless translation actually came back
 * off WITH a reason — "nobody asked for translation" must stay silent.
 */
export function TolqiaPlanNotice({ call }: { call: ChatCallView }) {
  const t = useChatI18n();
  const reason = call.translation?.enabled === true ? null : tolqiaReason(call.translation?.reason);
  if (!reason) return null;
  const wanted = call.participants.filter((p) => p.translate).length;
  const text = tolqiaPlanMessage(t, reason, wanted);
  if (!text) return null;
  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
      <i className="ti ti-info-circle shrink-0 text-sm" aria-hidden="true" />
      <span className="min-w-0 flex-1">{text}</span>
      <a
        href={TOLQIA_PRICING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 font-medium text-primary hover:underline"
      >
        {t.call.plan.pricing}
      </a>
    </div>
  );
}

/**
 * The badge + notice at the top of Ajustes › Llamadas.
 *
 * `plan === null` means "still loading": render nothing rather than flash a
 * "configure a token" warning at a server that is perfectly linked.
 */
export function TolqiaPlanRow({ plan, isAdmin }: { plan: TolqiaPlan | null; isAdmin: boolean }) {
  const t = useChatI18n();
  if (!plan) return null;

  if (!plan.configured) {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
        <i className="ti ti-alert-triangle mt-0.5 shrink-0 text-sm text-amber-500" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          {t.call.plan.notConfigured}
          {isAdmin && (
            <>
              {" "}
              <a href={TOLQIA_CREDENTIALS_HREF} className="font-medium text-primary hover:underline">
                {t.call.plan.configure}
              </a>
            </>
          )}
        </span>
      </div>
    );
  }

  const inactive = plan.status !== null && plan.status !== "active";
  const badge = plan.plan
    ? formatChatMessage(t.call.plan.badge, { plan: plan.plan[0]!.toUpperCase() + plan.plan.slice(1) })
    : t.call.plan.linked;
  const limit = plan.limits?.translationParticipants;
  const detail =
    plan.plan === null
      ? t.call.plan.unknown
      : inactive
        ? t.call.plan.inactive
        : limit === null || limit === undefined
          ? t.call.plan.translationUnlimited
          : formatChatMessage(t.call.plan.translationLimit, { count: limit });

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${
          inactive
            ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
        }`}
      >
        <i className={`ti ${inactive ? "ti-alert-circle" : "ti-circle-check"} text-xs`} aria-hidden="true" />
        {badge}
      </span>
      <span className="text-muted-foreground">{detail}</span>
      {inactive && (
        <a
          href={TOLQIA_PRICING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          {t.call.plan.pricing}
        </a>
      )}
    </div>
  );
}
