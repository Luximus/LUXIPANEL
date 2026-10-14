import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { getExecutor, LOCAL_TARGET_ID } from "../../../shared/executor/index.js";
import { saveLpApiKey, validateLpApiKey } from "../../../shared/lp-api-key.js";

const keyBody = z.object({ key: z.string().trim().regex(/^lxp_live_[0-9a-f]{64}$/) });

function requireLocalInstallation(req: Request): void {
  if (getExecutor(req).target.id !== LOCAL_TARGET_ID) {
    throw new AppError("Selecciona el servidor local para configurar la API KEY de esta instalación.", 409);
  }
}

export const installationApiKeyController = {
  status: asyncHandler(async (req: Request, res: Response) => {
    requireLocalInstallation(req);
    res.set("Cache-Control", "no-store");
    const status = await validateLpApiKey();
    res.json({ ok: true, data: { configured: status !== "missing", status } });
  }),

  save: asyncHandler(async (req: Request, res: Response) => {
    requireLocalInstallation(req);
    const parsed = keyBody.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Introduce una API KEY válida de Seguridad → API KEY en luxipanel.com.");
    const status = await validateLpApiKey(parsed.data.key);
    if (status === "unavailable") throw new AppError("No se pudo validar la API KEY con luxipanel.com. Inténtalo de nuevo.", 503);
    if (status !== "valid") throw new ValidationError("La API KEY no es válida o el servidor registrado está inactivo.");
    await saveLpApiKey(parsed.data.key);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, data: { configured: true, status: "valid" } });
  }),
};
