import type { RequestHandler } from "express";
import { localExecutor } from "../../../shared/executor/index.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { resolveLiveAuthorization } from "../services/live-authorization.service.js";

/** Installation-level diagnostics and source repairs require the LOCAL principal
 * from the signed JWT, independent of the tab's currently selected SSH target. */
export const requirePanelAdministrator: RequestHandler = async (_req, res, next) => {
  try {
    const base = (res.locals.authBaseUser || res.locals.user) as SessionUser | undefined;
    if (!base || base.tenantId || base.direct || (base.targetId && base.targetId !== "local")) throw new ForbiddenError("Logs requiere una sesión de administrador de la instalación local del panel.");
    const local = await resolveLiveAuthorization(base, localExecutor);
    if (local.kind !== "admin" || local.tenantId) throw new ForbiddenError("Solo los administradores de esta instalación pueden consultar Logs y reparar su código.");
    res.locals.logsUser = local;
    next();
  } catch (err) { next(err); }
};
