// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Transparent sudo-password injection at the executor boundary.
 *
 * Wraps an {@link Executor} so every `exec()` that runs a command-position
 * `sudo`/`sudo -n` is rewritten to feed the per-server stored sudo password
 * (when one exists) without changing the ~44 sudo call sites. All other
 * methods (file ops, spawn, batchSftp, target) pass through untouched.
 *
 * The wrapper passes the UNWRAPPED inner executor to the resolver so the
 * encrypted-credential read can't bounce back through this interceptor.
 */

import type { Executor } from "./types.js";
import { maybeInjectSudoPassword } from "../system/sudo-runtime.js";

const WRAPPED = Symbol("luxipanel.sudoWrapped");

export function wrapExecutorWithSudo(inner: Executor): Executor {
  if ((inner as unknown as Record<symbol, unknown>)[WRAPPED]) return inner;

  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (prop === WRAPPED) return true;
      if (prop === "exec") {
        return async (cmd: string, opts?: Parameters<Executor["exec"]>[1]) => {
          const finalCmd = await maybeInjectSudoPassword(target, cmd);
          return target.exec(finalCmd, opts);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
