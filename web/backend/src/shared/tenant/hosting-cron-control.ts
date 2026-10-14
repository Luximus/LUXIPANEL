import type { Executor } from "../executor/index.js";
import { getContextUser } from "../executor/context.js";
import { PrivilegeDropExecutor } from "../executor/privilege-drop-executor.js";
import { ForbiddenError } from "../errors/index.js";

export const HOSTING_CRON_WRAPPER_PATH = "/usr/lib/luxipanel/hosting-cron";
/** The only elevated Cron operation is installing/reading this caller's
 * compiled crontab. All commands in it run through the account supervisor. */
export function hostingCronControl(executor: Executor, username: string): Executor | null {
  const user = getContextUser();
  if (!user?.hostingPolicy?.runtime) return null;
  if (username !== user.username || !(executor instanceof PrivilegeDropExecutor)) throw new ForbiddenError("Hosting crontab identity mismatch");
  const service = executor.trustedServiceExecutorFor(user.owner ?? "");
  if (!service) throw new ForbiddenError("Hosting crontab service unavailable");
  return service;
}
