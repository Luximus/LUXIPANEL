// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Helper compartido para correr un comando del sistema EN EL SERVIDOR
 * CONECTADO a través del `Executor` de contexto. Antes vivía duplicado en
 * `users/services/system-accounts.service.ts` (con soporte de stdin) y
 * `users/services/ssh-keys.service.ts` (sin stdin).
 *
 * Por qué se necesita este helper y NO un simple `executor.exec` directo:
 *   - el comando siempre debe correr en el SERVIDOR CLIENTE, nunca en el host
 *     del panel (CLAUDE.md §managed-mode);
 *   - los comandos privilegiados pasan `sudo: true` (el wrapped executor
 *     inyecta el passphrase SSH como password de sudo);
 *   - comandos con stdin (p.ej. `chpasswd` con `user:pass`) requieren un tmp
 *     file 0600 + redirect dentro de `sudo sh -c`, porque `executor.exec` no
 *     acepta stdin y un pipe `echo | sudo` colisiona con `sudo -S` que también
 *     lee stdin (para el passphrase).
 */
import { randomUUID } from "node:crypto";
import { AppError } from "../errors/index.js";
import { quoteArg, quoteCmd } from "./quote.js";
import { requireExecutor } from "./require-executor.js";

export interface RunCommandOptions {
  /** Wraps the command in `sudo` (privilege drop lift). */
  sudo?: boolean;
  /** When `true`, the function does NOT throw on non-zero exit. */
  allowNonZeroExit?: boolean;
  /** Optional stdin to feed the command via a 0600 tmp file. */
  stdin?: string;
}

/**
 * Runs `binary [args...]` on the connected server. Returns the trimmed stdout
 * (or empty string). Throws `SYSTEM_COMMAND_FAILED` on non-zero exit unless
 * `allowNonZeroExit` is set. Throws `NO_SERVER_EXECUTOR` if no executor is
 * present in the current request context.
 */
export async function runCommand(
  binary: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<string> {
  const executor = requireExecutor();

  let cmd: string;
  let tmp: string | null = null;
  if (options.stdin !== undefined) {
    // 0600: el tmp guarda secretos (p.ej. `user:pass` para chpasswd). SFTP
    // honors the remote umask si no forzamos el mode → otro usuario en el
    // target podría leer el secret durante la ventana del exec.
    tmp = `/tmp/.lxp-runcmd-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await executor.writeFile(tmp, options.stdin, { encoding: "utf-8", mode: 0o600 });
    const inner = `${quoteCmd(binary, args)} < ${quoteArg(tmp)}`;
    cmd = options.sudo ? quoteCmd("sudo", ["sh", "-c", inner]) : quoteCmd("sh", ["-c", inner]);
  } else {
    cmd = options.sudo ? quoteCmd("sudo", [binary, ...args]) : quoteCmd(binary, args);
  }

  try {
    const res = await executor.exec(cmd);
    if (res.exitCode === 0 || options.allowNonZeroExit) {
      return (res.stdout || "").trim();
    }
    throw new AppError(
      `System command failed: ${binary} ${args.join(" ")}${res.stderr ? ` (${res.stderr.trim()})` : ""}`,
      500,
      "SYSTEM_COMMAND_FAILED",
    );
  } finally {
    if (tmp) await executor.unlink(tmp).catch(() => undefined);
  }
}
