// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * The server's tolqia.com plan, as the MESSENGER sees it.
 *
 * `GET /api/chat/tolqia/plan` is the only Tolqia endpoint every authenticated
 * user may call: it carries no token, no preview and no account-holder name —
 * just "is this server linked, to which plan, and may a call translate?".
 *
 * The answer is process-wide and changes about as often as a subscription, so
 * it is fetched ONCE per page load and shared by every consumer (the settings
 * drawer badge, the call overlay notice). `refreshTolqiaPlan()` drops the cache
 * for the rare case where the admin has just pasted a token in another tab.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export interface TolqiaPlanLimits {
  /** How many participants may have translation ON. `null` = unlimited. */
  translationParticipants: number | null;
  maxGroups: number | null;
  maxMembers: number | null;
}

export interface TolqiaPlan {
  /** Whether an admin linked this server to a tolqia.com account. */
  configured: boolean;
  /** `"plus"` / `"premium"`, or null when unknown (Tolqia unreachable). */
  plan: string | null;
  /** `"active"` / `"past_due"`, or null when unknown. */
  status: string | null;
  limits: TolqiaPlanLimits | null;
  translationAvailable: boolean;
}

/** What an unlinked (or not-yet-loaded) server looks like. */
export const UNLINKED_PLAN: TolqiaPlan = {
  configured: false,
  plan: null,
  status: null,
  limits: null,
  translationAvailable: false,
};

let inflight: Promise<TolqiaPlan> | null = null;

/** Fetch (once) the server's plan. Never rejects: a failure is "unlinked". */
export function fetchTolqiaPlan(): Promise<TolqiaPlan> {
  if (!inflight) {
    inflight = api
      .get<TolqiaPlan>("/api/chat/tolqia/plan")
      .then((res) => (res.ok && res.data ? res.data : UNLINKED_PLAN))
      .catch(() => UNLINKED_PLAN);
  }
  return inflight;
}

/** Drop the cached answer so the next read hits the backend again. */
export function refreshTolqiaPlan(): void {
  inflight = null;
}

/**
 * The plan, or `null` while it is still loading — the distinction matters: a
 * "configure a token" notice must not flash before the answer arrives.
 */
export function useTolqiaPlan(): TolqiaPlan | null {
  const [plan, setPlan] = useState<TolqiaPlan | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchTolqiaPlan().then((value) => {
      if (alive) setPlan(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return plan;
}

// ── Reasons ────────────────────────────────────────────────────────────────

/** Why Tolqia refused translation, or why starting a call failed. */
export type TolqiaReason =
  | "PLAN_LIMIT_TRANSLATION"
  | "PLAN_INACTIVE"
  | "PLAN_REQUIRED"
  | "TOKEN_INVALID";

/** Backend error `code` → the reason the UI localizes. */
const CODE_TO_REASON: Record<string, TolqiaReason> = {
  TOLQIA_PLAN_INACTIVE: "PLAN_INACTIVE",
  TOLQIA_PLAN_REQUIRED: "PLAN_REQUIRED",
  TOLQIA_TOKEN_INVALID: "TOKEN_INVALID",
};

/** Room `translation.reason` → the reason the UI localizes. */
const ROOM_TO_REASON: Record<string, TolqiaReason> = {
  PLAN_LIMIT_TRANSLATION: "PLAN_LIMIT_TRANSLATION",
  PLAN_INACTIVE: "PLAN_INACTIVE",
  PLAN_REQUIRED: "PLAN_REQUIRED",
};

/** Normalize whatever arrived (error code or room reason) to a `TolqiaReason`. */
export function tolqiaReason(raw: string | null | undefined): TolqiaReason | null {
  if (!raw) return null;
  return CODE_TO_REASON[raw] ?? ROOM_TO_REASON[raw] ?? null;
}

/** The pricing page every plan notice links to. */
export const TOLQIA_PRICING_URL = "https://tolqia.com/pricing";
/** Where an admin creates the token (Ajustes → Credenciales deep-links here). */
export const TOLQIA_CREDENTIALS_HREF = "/panel/settings#cred-tolqia";
