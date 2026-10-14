import { getContextUser } from "../../../shared/executor/context.js";
import { HOSTING_CRON_WRAPPER_PATH, hostingCronControl } from "../../../shared/tenant/hosting-cron-control.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { quoteCmd } from "../../../shared/executor/index.js";
import { ForbiddenError, ValidationError, NotFoundError } from "../../../shared/errors/index.js";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";

export interface CronOwner {
  username: string;
  home: string;
  /** The executor already runs as this Linux user (SSH or hosting privilege drop). */
  direct: boolean;
}

const SAFE_USER = /^[a-z_][a-z0-9_-]*\$?$/i;

/** Never take the crontab owner from an untrusted request for a non-admin. */
export async function resolveCronOwner(
  user: SessionUser | undefined,
  executor: Executor,
  requested?: unknown,
): Promise<CronOwner> {
  if (!user || user.kind === "external-guest" || user.kind === "mfa_pending") {
    throw new ForbiddenError("No hay una cuenta Linux autorizada para Cron.");
  }
  const ownName = user.username;
  const choice = typeof requested === "string" && requested.trim() ? requested.trim() : undefined;
  const username = user.kind === "admin" ? choice || "root" : ownName;
  if (user.kind !== "admin" && choice && choice !== ownName) {
    throw new ForbiddenError("Solo puedes administrar tu propio crontab.");
  }
  if (!SAFE_USER.test(username) || (user.kind !== "admin" && username === "root")) {
    throw new ValidationError("Usuario Linux no válido para Cron.");
  }
  const identityExecutor = hostingCronControl(executor, username) ?? executor;
  const result = await identityExecutor.exec(quoteCmd("getent", ["passwd", username]), { timeoutMs: 8_000 });
  const entry = result.stdout.trim().split("\n").find((line) => line.split(":")[0] === username);
  if (result.exitCode !== 0 || !entry) throw new NotFoundError("Usuario Linux en el servidor conectado");
  const home = entry.split(":")[5] || "";
  if (!/^\/[A-Za-z0-9_./-]+$/.test(home) || home.split("/").includes("..")) {
    throw new ValidationError("El usuario Linux no tiene un directorio personal válido.");
  }
  return {
    username,
    home: home.replace(/\/+$/, "") || "/",
    direct: isHostingSession(user) || executor.sshUsername === username,
  };
}

/** Admin-only picker, independent of the Users module's enablement. */
export async function listCronUsers(executor: Executor): Promise<Array<{ username: string; uid: number }>> {
  const result = await executor.exec(quoteCmd("getent", ["passwd"]), { timeoutMs: 8_000 });
  if (result.exitCode !== 0) throw new ValidationError("No se pudieron listar los usuarios Linux.");
  return result.stdout.split("\n").map((line) => {
    const fields = line.split(":");
    return { username: fields[0] || "", uid: Number(fields[2]) };
  }).filter((row) => SAFE_USER.test(row.username) && (row.username === "root" || row.uid >= 1000))
    .sort((a, b) => a.username === "root" ? -1 : b.username === "root" ? 1 : a.username.localeCompare(b.username));
}

export function cronUserLogsRoot(owner: CronOwner): string {
  return `${owner.home}/.local/state/luxipanel/cron/logs`;
}

export function cronUserWrapperPath(owner: CronOwner): string {
  if (getContextUser()?.hostingPolicy?.runtime) return HOSTING_CRON_WRAPPER_PATH;
  return `${owner.home}/.local/libexec/luxipanel/lxp-cron-run`;
}
