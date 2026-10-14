// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mail target-host resolution (per-server isolation for IMAP/SMTP sockets).
 *
 * The mailbox lives on the SERVER THE SESSION IS BRIDGED TO — not on the panel
 * host. Historically every IMAP/SMTP connection was opened from the panel's own
 * Node process with a `localhost` default, so when the operator was switched to
 * a REMOTE target the panel silently read/sent the panel host's OWN mail. This
 * resolver closes that leak: it maps the per-request context executor to the
 * concrete SSH host of the connected target so the connection code can:
 *   - LOCAL session  → keep the current behaviour (localhost fallback allowed);
 *   - REMOTE session → connect to the target's host (and domain-derived names)
 *     and NEVER fall back to `localhost` (fail-closed).
 *
 * The target's SSH host doubles as the primary mail-host candidate: postfix/
 * dovecot run on that same box (or a `mail.<domain>` that resolves to it).
 *
 * v2 (pending): for a remote target with 143/587 firewalled shut, tunnel the
 * IMAP/SMTP socket through the executor (SSH local-forward) instead of dialing
 * the host directly. Until then a locked-down remote box surfaces a typed
 * `MAIL_IMAP_UNREACHABLE` / SMTP error rather than a wrong-tenant success.
 */

import {
  getContextExecutor,
  runOnPanelHost,
  LOCAL_TARGET_ID,
} from "../../../shared/executor/index.js";
import { AppError } from "../../../shared/errors/index.js";
// The local SSH target vault is control-plane state of the panel host; reading
// a target record to learn its host mirrors how ai-assistant resolves targets.
import { targetsRepository } from "../../servers/index.js";

export interface MailTarget {
  /**
   * SSH host of the connected REMOTE target, used as the primary mail-host
   * candidate. `undefined` for a LOCAL session (panel host) — the connection
   * code then keeps its historical `localhost` fallback.
   */
  targetHost?: string;
}

/**
 * Resolve the current session's mail target host from the per-request executor.
 * Fail-closed: throws when there is no context executor, and (for a remote
 * target) when the vault has no host for it — never degrades to `localhost`.
 */
export async function resolveMailTargetHost(): Promise<MailTarget> {
  const executor = getContextExecutor();
  if (!executor) {
    // No per-server executor in scope → we cannot know which mailbox server to
    // dial. Refuse rather than open a socket to the panel host (isolation).
    throw new AppError(
      "No hay un servidor conectado para resolver el buzón de correo.",
      428,
      "MAIL_NO_SERVER_EXECUTOR",
    );
  }

  // Local session: the panel manages its own box — historical behaviour intact.
  if (executor.target.id === LOCAL_TARGET_ID) return {};

  const targetId = executor.target.id;
  // The vault is pinned to the panel host; read it there regardless of the
  // ambient per-server executor.
  const record = await runOnPanelHost(() => targetsRepository.get(targetId));
  const host = record?.host?.trim();
  if (!host) {
    throw new AppError(
      `No se pudo resolver el host de correo del servidor remoto (${targetId}).`,
      502,
      "MAIL_REMOTE_HOST_UNRESOLVED",
    );
  }
  return { targetHost: host };
}
