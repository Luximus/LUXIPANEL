// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * "Enqueue this recipe and do NOT return until the worker applied it."
 *
 * `hosting.service#applyTenantSteps`, `jail.service#applyTenantSteps` (whose
 * own comment admitted the copy — "Se duplica aquí a propósito para evitar un
 * ciclo de imports") and `users.service#applyUserSteps` all wrapped
 * `submitMutation` with the exact same three rules:
 *
 *   1. an empty step list is a no-op,
 *   2. wait 30 s for terminal state (the panel-side sync that follows needs the
 *      Linux account/jail to already exist),
 *   3. anything other than `mode === "applied"` is a 504 with the caller's own
 *      error code.
 *
 * Living in `shared/remote-cache` (not in a module) is what removes the import
 * cycle the duplicated copy was working around.
 */

import { AppError } from "../errors/index.js";
import type { ErrorCode } from "../errors/codes.js";
import type { Executor } from "../executor/types.js";
import {
  submitMutation,
  type SubmitMutationInput,
  type SubmitMutationResult,
} from "./submit-mutation.js";

/**
 * Default wait for terminal state. `useradd`/`usermod`/jail steps are fast
 * on-box; the wait exists so the panel's follow-up read observes the change.
 */
export const APPLY_STEPS_SYNC_WAIT_MS = 30_000;

export interface ApplyStepsOrThrowOptions extends Omit<SubmitMutationInput, "syncWaitMs"> {
  /** Message of the 504 thrown when the job does not reach `applied`. */
  notConfirmedMessage: string;
  /** Stable error code of that 504 (e.g. `USER_OP_NOT_CONFIRMED`). */
  notConfirmedCode: ErrorCode;
  /** Override the terminal-state wait. Defaults to 30 s. */
  syncWaitMs?: number;
}

/**
 * Submit `spec.steps` and BLOCK until the worker reports `applied`.
 *
 * @returns the submit result, or `null` when there was nothing to do.
 * @throws  `AppError(504, notConfirmedCode)` if the job never reached `applied`.
 */
export async function applyStepsOrThrow(
  executor: Executor,
  spec: ApplyStepsOrThrowOptions,
): Promise<SubmitMutationResult | null> {
  const { notConfirmedMessage, notConfirmedCode, syncWaitMs, ...input } = spec;
  if (input.steps.length === 0) return null;
  const result = await submitMutation(executor, {
    ...input,
    syncWaitMs: syncWaitMs ?? APPLY_STEPS_SYNC_WAIT_MS,
  });
  if (result.mode !== "applied") {
    throw new AppError(notConfirmedMessage, 504, notConfirmedCode);
  }
  return result;
}
