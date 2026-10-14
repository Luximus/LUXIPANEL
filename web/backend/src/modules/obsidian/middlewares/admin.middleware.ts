import type { RequestHandler } from "express";
import { ForbiddenError } from "../../../shared/errors/index.js";

export const requireObsidianAdmin: RequestHandler = (_req, res, next) => res.locals.user?.kind === "admin"
  ? next() : next(new ForbiddenError("Solo un administrador puede gestionar vaults e integraciones IA."));
