// Structured private data adapter is shipped as a native ESM module.
// @ts-ignore provider extension distributed alongside this route
import { deploymentDataRequest } from "../services/deployment-data-provider.mjs";
import { Router, raw } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { AuthError } from "../../../shared/errors/index.js";
import { providerService } from "../services/provider.service.js";
import type {
  HostingProvider,
  ProviderOperation,
} from "../models/provider.model.js";
import {
  deploymentProviderService as service,
  deploymentSnapshotSchema,
  deploymentJobSchema,
  deploymentProductionRoutesSchema,
} from "../services/deployment-provider.service.js";
export const deploymentProviderRouter = Router();
const base = "/api/hosting/v1/accounts/:account/deployments/:project";
deploymentProviderRouter.use(
  "/api/hosting/v1/accounts/:account/deployments",
  asyncHandler(async (req, res, next) => {
    const authorization = req.headers.authorization ?? "";
    if (!authorization.startsWith("Bearer lhp_"))
      throw new AuthError("Credencial de proveedor requerida");
    (res.locals as any).deploymentProvider = await providerService.authenticate(
      authorization.slice(7),
    );
    next();
  }),
);
const provider = (res: any, operation: ProviderOperation) => {
  const value = res.locals.deploymentProvider as HostingProvider;
  providerService.assertOperation(value, operation);
  return value;
};
const refs = (req: any) =>
  [String(req.params.account), String(req.params.project)] as const;
deploymentProviderRouter.put(
  base,
  asyncHandler(async (req, res) => {
    res.json({
      ok: true,
      data: await service.register(
        provider(res, "deployments.write"),
        ...refs(req),
      ),
    });
  }),
);
deploymentProviderRouter.put(
  base + "/versions/:version",
  asyncHandler(async (req, res) => {
    res.json({
      ok: true,
      data: await service.snapshot(
        provider(res, "deployments.write"),
        ...refs(req),
        String(req.params.version),
        deploymentSnapshotSchema.parse(req.body),
      ),
    });
  }),
);
deploymentProviderRouter.put(
  base + "/versions/:version/source",
  raw({ type: "application/octet-stream", limit: "32mb" }),
  asyncHandler(async (req, res) => {
    res.json({
      ok: true,
      data: await service.source(
        provider(res, "deployments.write"),
        ...refs(req),
        String(req.params.version),
        req.body,
      ),
    });
  }),
);
deploymentProviderRouter.post(
  base + "/jobs",
  asyncHandler(async (req, res) => {
    const input = deploymentJobSchema.parse(req.body);
    res
      .status(202)
      .json({
        ok: true,
        data: await service.enqueue(
          provider(
            res,
            input.environment === "production"
              ? "deployments.publish"
              : "deployments.build",
          ),
          ...refs(req),
          input,
        ),
      });
  }),
);
deploymentProviderRouter.put(
  base + "/routes/production",
  asyncHandler(async (req, res) => {
    res.json({
      ok: true,
      data: await service.replaceProductionRoutes(
        provider(res, "deployments.publish"),
        ...refs(req),
        deploymentProductionRoutesSchema.parse(req.body),
      ),
    });
  }),
);
deploymentProviderRouter.delete(
  base + "/routes/production",
  asyncHandler(async (req, res) => {
    res.json({
      ok: true,
      data: await service.removeProductionRoutes(
        provider(res, "deployments.publish"),
        ...refs(req),
      ),
    });
  }),
);
deploymentProviderRouter.get(
  base + "/jobs/:job",
  asyncHandler(async (req, res) => {
    res.json({
      ok: true,
      data: await service.job(
        provider(res, "deployments.read"),
        ...refs(req),
        String(req.params.job),
      ),
    });
  }),
);
deploymentProviderRouter.post(
  base + "/jobs/:job/activate",
  asyncHandler(async (req, res) => {
    res.json({
      ok: true,
      data: await service.activate(
        provider(res, "deployments.publish"),
        ...refs(req),
        String(req.params.job),
      ),
    });
  }),
);
deploymentProviderRouter.get(
  base + "/jobs/:job/static/:component",
  asyncHandler(async (req, res) => {
    const artifact = await service.staticArtifact(
      provider(res, "deployments.read"), ...refs(req), String(req.params.job), String(req.params.component),
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", artifact.bytes.length);
    res.setHeader("X-Luxi-Static-Sha256", artifact.sha256);
    res.send(artifact.bytes);
  }),
);
deploymentProviderRouter.put(
  base + "/jobs/:job/static/:component/retained",
  raw({ type: "application/octet-stream", limit: "32mb" }),
  asyncHandler(async (req, res) => {
    res.json({ ok: true, data: await service.retainStaticArtifact(
      provider(res, "deployments.publish"), ...refs(req), String(req.params.job), String(req.params.component), req.body,
    ) });
  }),
);
deploymentProviderRouter.delete(
  base + "/jobs/:job/static/:component",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, data: await service.deleteStaticArtifact(
      provider(res, "deployments.write"), ...refs(req), String(req.params.job), String(req.params.component),
    ) });
  }),
);
deploymentProviderRouter.post(
  base + "/jobs/:job/cleanup",
  asyncHandler(async (req, res) => {
    res.json({
      ok: true,
      data: await service.activate(
        provider(res, "deployments.publish"),
        ...refs(req),
        String(req.params.job),
        "cleanup",
      ),
    });
  }),
);
deploymentProviderRouter.delete(
  base,
  asyncHandler(async (req, res) => {
    res.json({
      ok: true,
      data: await service.retire(
        provider(res, "deployments.write"),
        ...refs(req),
      ),
    });
  }),
);

deploymentProviderRouter.post(base + "/data", asyncHandler(async (req, res) => {
  const authenticated = res.locals.deploymentProvider as HostingProvider;
  res.setHeader("cache-control", "private, no-store");
  res.json({ok:true,data:await deploymentDataRequest(authenticated,...refs(req),req.body)});
}));
