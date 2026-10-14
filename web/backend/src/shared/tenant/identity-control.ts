import { getContextExecutor, getContextUser, runWithExecutor, getContextPermissionAction, runWithPermissionAction, getFileJailPaths, setContextFileJail } from "../executor/context.js";
import { PrivilegeDropExecutor } from "../executor/privilege-drop-executor.js";
import { isHostingSession, getTenantEnvelope } from "./tenant-scope.js";
import { ForbiddenError } from "../errors/index.js";
/** Used exclusively by the tenant-scoped Users/Groups business layer. Its
 * validators retain the caller's envelope while Linux and metadata operations
 * use the panel's service identity on the SAME server. */
export function withTenantIdentityControl<T>(fn: () => T): T {
  const user = getContextUser(), executor = getContextExecutor();
  if (!user || !isHostingSession(user)) return fn();
  if (!executor) throw new ForbiddenError("Tenant identity executor missing");
  const envelope = getTenantEnvelope(user);
  const service = executor instanceof PrivilegeDropExecutor ? executor.trustedServiceExecutorFor(envelope.owner) : executor;
  if (!service) throw new ForbiddenError("Tenant service identity mismatch");
  const action = getContextPermissionAction(), jail = getFileJailPaths();
  return runWithExecutor(service, () => {
    if (jail) setContextFileJail(jail);
    return action ? runWithPermissionAction(action, fn) : fn();
  }, user.userId, user);
}
