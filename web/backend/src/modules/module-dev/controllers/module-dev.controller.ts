/**
 * Controller del módulo module-dev ("Mis módulos" del marketplace).
 *
 * Todas las rutas son admin-only en v1 (el guard vive en routes): la identidad
 * de developer ante LP es el customer dueño del panel; abrir el ciclo a
 * usuarios no-admin requiere el modelo identidad-por-linux-user (pendiente).
 *
 * Respuesta SIEMPRE { ok, data } / errores tipados al error handler central.
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler, type SessionUser } from "../../../shared/types/index.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { env } from "../../../config/env.js";
import { marketplaceLinkRepository, MODULE_ID_RE } from "../../../shared/marketplace-link/index.js";
import { lpProxyService } from "../services/lp-proxy.service.js";
import { validateManifest } from "../services/manifest-validator.service.js";
import { testRunnerService } from "../services/test-runner.service.js";
import { previewService } from "../services/preview.service.js";
import { projectExplorerService } from "../services/project-explorer.service.js";

// MODULE_ID_RE is the single source of truth in shared/marketplace-link.
const moduleIdSchema = z.string().regex(MODULE_ID_RE, "id de módulo inválido");
const projectIdSchema = z.string().min(1).max(128);

const submitSchema = z.object({
  moduleId: moduleIdSchema,
  prUrl: z.string().url().max(512),
  scope: z.enum(["local", "global"]).optional(),
});
const resubmitSchema = z.object({ prUrl: z.string().url().max(512) });
const validateManifestSchema = z.object({ manifest: z.record(z.unknown()) });
const checksRunSchema = z.object({ projectId: projectIdSchema });
const testsRunSchema = z.object({
  projectId: projectIdSchema,
  timeoutMs: z.coerce.number().int().positive().max(600_000).optional(),
});
const previewInstallSchema = z.object({ projectId: projectIdSchema });
const previewUninstallSchema = z.object({ moduleId: moduleIdSchema });
const previewToolBodySchema = z.object({ input: z.record(z.unknown()).optional() });
const toolNameSchema = z.string().regex(/^[a-z][a-z0-9_-]*$/, "nombre de tool inválido");

/**
 * Host público del panel (LP resuelve panel→customer por host en managed).
 * SIEMPRE el de la SESIÓN (`targetHost`: claim `thost` del SSO de LP, o host
 * validado contra el subdominio del login direct en el middleware) — NUNCA
 * `x-forwarded-host`/`host`, que llegan tal cual del cliente y permitirían
 * operar los módulos del customer de OTRO panel (BOLA). Sin host de sesión el
 * proxy a LP falla tipado (fail-closed, MODULE_DEV_NO_HOST).
 */
function hostFrom(res: Response): string | undefined {
  const user = res.locals.user as SessionUser | undefined;
  const host = (user?.targetHost ?? "").trim();
  return host || undefined;
}

/** LP derives the installation identity from its per-panel API key. */
function marketplaceHost(_req: Request, res: Response): string {
  return hostFrom(res) || env.WEBAUTHN_RP_ID;
}

function sessionUser(res: Response): SessionUser {
  const user = res.locals.user as SessionUser | undefined;
  if (!user) throw new ForbiddenError("Authentication required");
  return user;
}

export const moduleDevController = {
  /** Read-only explorer of this panel's checkout, independent of selected target. */
  listProjectFiles: asyncHandler(async (req: Request, res: Response) => {
    const path = z.string().max(768).default("").parse(req.query.path);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, data: await projectExplorerService.list(path) });
  }),

  searchProjectFiles: asyncHandler(async (req: Request, res: Response) => {
    const query = z.string().min(2).max(100).parse(req.query.q);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, data: await projectExplorerService.search(query) });
  }),

  readProjectFile: asyncHandler(async (req: Request, res: Response) => {
    const path = z.string().min(1).max(768).parse(req.query.path);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, data: await projectExplorerService.file(path) });
  }),

  refreshProjectFiles: asyncHandler(async (_req: Request, res: Response) => {
    projectExplorerService.refresh();
    res.json({ ok: true, data: { refreshed: true } });
  }),

  /** GET /api/module-dev/modules — módulos del dev con su estado (caché si LP cae). */
  listModules: asyncHandler(async (req: Request, res: Response) => {
    const result = await lpProxyService.listModules(marketplaceHost(req, res));
    res.json({
      ok: true,
      data: { modules: result.data, stale: result.stale, fetchedAt: result.fetchedAt, marketplaceAvailable: true },
    });
  }),

  /** GET /api/module-dev/modules/:code/reviews — timeline de revisión. */
  getReviews: asyncHandler(async (req: Request, res: Response) => {
    const code = moduleIdSchema.parse(req.params.code);
    const result = await lpProxyService.getReviews(code, marketplaceHost(req, res));
    const reviews = result.data ?? { module: { code, reviewStatus: "" }, versions: [], events: [] };
    res.json({
      ok: true,
      data: {
        module: reviews.module ?? { code, reviewStatus: "" },
        versions: Array.isArray(reviews.versions) ? reviews.versions : [],
        events: Array.isArray(reviews.events) ? reviews.events : [],
        stale: result.stale,
        fetchedAt: result.fetchedAt,
      },
    });
  }),

  /** POST /api/module-dev/modules/submit — enviar a revisión (gate IA). */
  submit: asyncHandler(async (req: Request, res: Response) => {
    const input = submitSchema.parse(req.body ?? {});
    const data = await lpProxyService.submit(input, marketplaceHost(req, res));
    res.json({ ok: true, data });
  }),

  /** POST /api/module-dev/modules/:code/resubmit — reenviar tras corrección. */
  resubmit: asyncHandler(async (req: Request, res: Response) => {
    const code = moduleIdSchema.parse(req.params.code);
    const { prUrl } = resubmitSchema.parse(req.body ?? {});
    const data = await lpProxyService.resubmit(code, prUrl, marketplaceHost(req, res));
    res.json({ ok: true, data });
  }),

  /** POST /api/module-dev/modules/:code/unpublish — publico → inactivo. */
  unpublish: asyncHandler(async (req: Request, res: Response) => {
    const code = moduleIdSchema.parse(req.params.code);
    const data = await lpProxyService.unpublish(code, marketplaceHost(req, res));
    res.json({ ok: true, data });
  }),

  /** POST /api/module-dev/modules/:code/republish — inactivo → publico. */
  republish: asyncHandler(async (req: Request, res: Response) => {
    const code = moduleIdSchema.parse(req.params.code);
    const data = await lpProxyService.republish(code, marketplaceHost(req, res));
    res.json({ ok: true, data });
  }),

  /** POST /api/module-dev/manifest/validate — validador puro del manifest. */
  validateManifest: asyncHandler(async (req: Request, res: Response) => {
    const { manifest } = validateManifestSchema.parse(req.body ?? {});
    res.json({ ok: true, data: validateManifest(manifest) });
  }),

  /** POST /api/module-dev/checks/run — checks estáticos (no ejecuta nada). */
  runChecks: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = checksRunSchema.parse(req.body ?? {});
    res.json({ ok: true, data: await testRunnerService.runChecks(projectId) });
  }),

  /** POST /api/module-dev/tests/run — suite del módulo en el TARGET. */
  runTests: asyncHandler(async (req: Request, res: Response) => {
    const { projectId, timeoutMs } = testsRunSchema.parse(req.body ?? {});
    res.json({ ok: true, data: await testRunnerService.runTests(projectId, timeoutMs) });
  }),

  /** GET /api/module-dev/links — vínculos proyecto↔módulo del target actual. */
  listLinks: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const links = await marketplaceLinkRepository.list(executor);
    res.json({ ok: true, data: { links } });
  }),

  /** GET /api/module-dev/preview — previews instalados (Modo B). */
  listPreviews: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ ok: true, data: { previews: previewService.list() } });
  }),

  /** POST /api/module-dev/preview/install — vendoriza el módulo como preview. */
  previewInstall: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = previewInstallSchema.parse(req.body ?? {});
    const data = await previewService.install(projectId, sessionUser(res));
    res.json({ ok: true, data });
  }),

  /** POST /api/module-dev/preview/uninstall — elimina el preview (solo owner). */
  previewUninstall: asyncHandler(async (req: Request, res: Response) => {
    const { moduleId } = previewUninstallSchema.parse(req.body ?? {});
    const data = await previewService.uninstall(moduleId, sessionUser(res));
    res.json({ ok: true, data });
  }),

  /** POST /api/module-dev/preview/:moduleId/tool/:name — dispatch de prueba. */
  previewTool: asyncHandler(async (req: Request, res: Response) => {
    const moduleId = moduleIdSchema.parse(req.params.moduleId);
    const name = toolNameSchema.parse(req.params.name);
    const { input } = previewToolBodySchema.parse(req.body ?? {});
    const out = await previewService.dispatchPreviewTool(moduleId, name, input, sessionUser(res));
    res.json({ ok: out.ok, data: out.output });
  }),
};
