// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo — AI agent capability.
 *
 * Every tool name is prefixed `expo.` (the registry throws otherwise).
 * Handlers run inside the assistant request scope; each pins the request
 * executor via `requireExecutor()` and wraps the service call in
 * `runWithExecutor` so the stored token (settingsRepository) and the EAS CLI
 * resolve against the connected server (cloudflare withZone pattern).
 *
 * Handler return contract: { ok:true, output } (JSON-serializable) or
 * { ok:false, output: "<ES error string>" }.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { runWithExecutor, type Executor } from "../../shared/executor/index.js";
import {
  appleCredentialSchema,
  buildCancelSchema,
  buildListSchema,
  buildSchema,
  buildViewSchema,
  deviceCreateSchema,
  devClientSchema,
  envListSchema,
  envSetSchema,
  googleCredentialSchema,
  initProjectSchema,
  linkProjectSchema,
  projectPathSchema,
  scanProjectsSchema,
  submitSchema,
  updatePublishSchema,
  webhookCreateSchema,
} from "./models/index.js";
import { expoConfigService } from "./services/expo-config.service.js";
import { expoService } from "./services/expo.service.js";

type ToolOutput = { ok: boolean; output: unknown };

/** Shared preamble: pin the request executor and run inside its scope. */
async function withExpo(fn: (executor: Executor) => Promise<ToolOutput>): Promise<ToolOutput> {
  const executor = requireExecutor();
  return runWithExecutor(executor, () => fn(executor));
}

const PATH_PROPERTY = {
  path: {
    type: "string",
    description: "Ruta absoluta del proyecto Expo en el servidor conectado",
  },
} as const;

export const expoAgentCapability: AgentCapability = {
  moduleId: "expo",
  version: 1,
  tools: [
    {
      name: "expo.status",
      title: "Estado de Expo",
      description:
        "Returns whether an Expo access token is configured and, if so, the logged-in Expo account. The token itself is never returned.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: () =>
        withExpo(async (executor) => {
          const cfg = await expoConfigService.getConfig();
          if (!cfg.tokenSet) return { ok: true, output: { tokenSet: false, account: null } };
          const me = await expoService.whoami(executor);
          return { ok: true, output: { tokenSet: true, ...me } };
        }),
    },
    {
      name: "expo.account",
      title: "Cuenta de Expo",
      description:
        "Resolve the authenticated Expo account and the owned account/organization names via the Expo API.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: () =>
        withExpo(async () => {
          const account = await expoService.account();
          return { ok: true, output: account };
        }),
    },
    {
      name: "expo.list_projects",
      title: "Listar proyectos Expo",
      description:
        "Scan the connected server for Expo / React Native projects (dirs with app.json or app.config.{js,ts}) and report path, slug and EAS projectId. Optional 'root' restricts the scan directory.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          root: { type: "string", description: "Absolute directory to scan (defaults to the user's home)" },
        },
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const { root } = scanProjectsSchema.parse(input);
          const projects = await expoService.listProjects(executor, root);
          return { ok: true, output: projects };
        }),
    },
    {
      name: "expo.project_info",
      title: "Información de proyecto",
      description: "Full info for one Expo project: slug, EAS projectId, bundle ids, eas.json presence.",
      kind: "read",
      inputSchema: { type: "object", properties: { ...PATH_PROPERTY }, required: ["path"] },
      handler: (input) =>
        withExpo(async (executor) => {
          const { path } = projectPathSchema.parse(input);
          const info = await expoService.projectInfo(executor, path);
          return { ok: true, output: info };
        }),
    },
    {
      name: "expo.init_project",
      title: "Crear proyecto Expo",
      description:
        "Create a new Expo app from scratch (create-expo-app) under 'root' with name 'name' (optional 'template'), then run eas init. Long-running.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          root: { type: "string", description: "Parent directory for the new app folder (absolute)" },
          name: { type: "string", description: "App / folder name" },
          template: { type: "string", description: "Expo template (e.g. 'blank', 'tabs', 'default')" },
        },
        required: ["root", "name"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = initProjectSchema.parse(input);
          const result = await expoService.initProject(executor, parsed);
          return { ok: result.ok, output: result };
        }),
    },
    {
      name: "expo.link_project",
      title: "Enlazar proyecto a EAS",
      description:
        "Link an existing project to EAS (eas init), optionally attaching a known 'projectId'.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...PATH_PROPERTY,
          projectId: { type: "string", description: "Existing EAS project id to attach" },
        },
        required: ["path"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = linkProjectSchema.parse(input);
          const result = await expoService.linkProject(executor, parsed);
          return { ok: result.ok, output: result };
        }),
    },
    {
      name: "expo.build",
      title: "Lanzar build EAS",
      description:
        "Start an EAS build. platform = android|ios|all, profile = development|preview|production (default production). Non-interactive, no-wait — returns the build id + dashboard URL.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...PATH_PROPERTY,
          platform: { type: "string", enum: ["android", "ios", "all"] },
          profile: { type: "string", enum: ["development", "preview", "production"] },
        },
        required: ["path", "platform"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = buildSchema.parse(input);
          const result = await expoService.build(executor, parsed);
          return { ok: result.ok, output: result };
        }),
    },
    {
      name: "expo.build_list",
      title: "Historial de builds",
      description: "List recent EAS builds of a project with status, platform, profile and dashboard URLs.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          ...PATH_PROPERTY,
          limit: { type: "number", description: "Max builds to return (1..50)" },
        },
        required: ["path"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = buildListSchema.parse(input);
          const builds = await expoService.buildList(executor, parsed);
          return { ok: true, output: builds };
        }),
    },
    {
      name: "expo.build_view",
      title: "Estado de un build",
      description: "Fetch the current status / progress of a single EAS build by id.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: { ...PATH_PROPERTY, buildId: { type: "string", description: "EAS build id" } },
        required: ["path", "buildId"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const { path, buildId } = buildViewSchema.parse(input);
          const build = await expoService.buildView(executor, path, buildId);
          if (!build) return { ok: false, output: `Build no encontrado: ${buildId}` };
          return { ok: true, output: build };
        }),
    },
    {
      name: "expo.build_cancel",
      title: "Cancelar build",
      description: "Cancel an in-progress EAS build by id.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: { ...PATH_PROPERTY, buildId: { type: "string", description: "EAS build id" } },
        required: ["path", "buildId"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const { path, buildId } = buildCancelSchema.parse(input);
          const result = await expoService.buildCancel(executor, path, buildId);
          return { ok: result.ok, output: result };
        }),
    },
    {
      name: "expo.submit",
      title: "Enviar a la tienda",
      description:
        "Submit the latest build to a store: platform = android (Play Store) or ios (App Store), using the given submit profile (default production). Requires store-account credentials configured in eas.json.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...PATH_PROPERTY,
          platform: { type: "string", enum: ["android", "ios"] },
          profile: { type: "string", description: "eas.json submit profile (default 'production')" },
        },
        required: ["path", "platform"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = submitSchema.parse(input);
          const result = await expoService.submit(executor, parsed);
          return { ok: result.ok, output: result };
        }),
    },
    {
      name: "expo.dev_client",
      title: "Arrancar dev-client (QR)",
      description:
        "Start Metro with the dev-client on the CONNECTED server and capture the exp:// URL / QR so a phone (Expo Go / dev-client) can connect. Note: Metro runs on the connected server; use tunnel=true for cross-network testing.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...PATH_PROPERTY,
          tunnel: { type: "boolean", description: "Use a tunnel for cross-network access" },
        },
        required: ["path"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = devClientSchema.parse(input);
          const session = await expoService.startDevClient(executor, parsed);
          return { ok: true, output: session };
        }),
    },
    {
      name: "expo.quota",
      title: "Cuota de builds",
      description:
        "Report the Expo build quota / plan (concurrency, remaining builds) via the Expo API, falling back to a count of builds this month.",
      kind: "read",
      inputSchema: { type: "object", properties: { ...PATH_PROPERTY }, required: ["path"] },
      handler: (input) =>
        withExpo(async (executor) => {
          const { path } = projectPathSchema.parse(input);
          const quota = await expoService.getQuota(executor, path);
          return { ok: true, output: quota };
        }),
    },
    {
      name: "expo.update",
      title: "Publicar OTA update",
      description:
        "Publish a JS-only OTA update with eas update to a branch/channel, with an optional message.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...PATH_PROPERTY,
          branch: { type: "string", description: "Branch / channel name" },
          message: { type: "string", description: "Update message" },
        },
        required: ["path", "branch"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = updatePublishSchema.parse(input);
          const result = await expoService.updatePublish(executor, parsed);
          return { ok: result.ok, output: result };
        }),
    },
    {
      name: "expo.env_list",
      title: "Listar variables EAS",
      description: "List the EAS environment variables of a project (optionally by scope project|account).",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          ...PATH_PROPERTY,
          scope: { type: "string", enum: ["project", "account"] },
        },
        required: ["path"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = envListSchema.parse(input);
          const vars = await expoService.envList(executor, parsed);
          return { ok: true, output: vars };
        }),
    },
    {
      name: "expo.env_set",
      title: "Crear variable EAS",
      description:
        "Create an EAS environment variable. scope = project|account (default project); visibility = plaintext|sensitive|secret (default sensitive).",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...PATH_PROPERTY,
          name: { type: "string", description: "Variable name (UPPER_SNAKE)" },
          value: { type: "string", description: "Variable value" },
          scope: { type: "string", enum: ["project", "account"] },
          visibility: { type: "string", enum: ["plaintext", "sensitive", "secret"] },
        },
        required: ["path", "name", "value"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = envSetSchema.parse(input);
          await expoService.envSet(executor, parsed);
          return { ok: true, output: { created: parsed.name } };
        }),
    },
    {
      name: "expo.set_google_credential",
      title: "Credencial de Play Store",
      description:
        "Store the Google Play service-account JSON on the connected server (mode 0600) for use in eas.json submit profiles. Provide the raw JSON body.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...PATH_PROPERTY,
          serviceAccountJson: { type: "string", description: "Raw service-account JSON" },
        },
        required: ["path", "serviceAccountJson"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = googleCredentialSchema.parse(input);
          const result = await expoService.setGoogleCredential(executor, parsed);
          return { ok: true, output: result };
        }),
    },
    {
      name: "expo.set_apple_credential",
      title: "Credencial de App Store",
      description:
        "Store the Apple App Store Connect API key (.p8 + issuerId + keyId) on the connected server (mode 0600) for eas.json submit profiles.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...PATH_PROPERTY,
          issuerId: { type: "string", description: "ASC issuer id" },
          keyId: { type: "string", description: "ASC key id" },
          p8: { type: "string", description: "Raw AuthKey_XXXX.p8 contents" },
        },
        required: ["path", "issuerId", "keyId", "p8"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = appleCredentialSchema.parse(input);
          const result = await expoService.setAppleCredential(executor, parsed);
          return { ok: true, output: result };
        }),
    },
    {
      name: "expo.webhook_create",
      title: "Registrar webhook EAS",
      description:
        "Register an EAS webhook (BUILD or SUBMIT) pointing at a URL, e.g. back to the panel for build-completion notifications.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...PATH_PROPERTY,
          url: { type: "string", description: "Webhook URL" },
          event: { type: "string", enum: ["BUILD", "SUBMIT"] },
        },
        required: ["path", "url"],
      },
      handler: (input) =>
        withExpo(async (executor) => {
          const parsed = webhookCreateSchema.parse(input);
          const result = await expoService.webhookCreate(executor, parsed);
          return { ok: result.ok, output: result };
        }),
    },
    {
      name: "expo.device_create",
      title: "Registrar dispositivo iOS",
      description: "Register an iOS device for internal distribution (eas device:create).",
      kind: "action",
      dangerous: true,
      inputSchema: { type: "object", properties: { ...PATH_PROPERTY }, required: ["path"] },
      handler: (input) =>
        withExpo(async (executor) => {
          const { path } = deviceCreateSchema.parse(input);
          const result = await expoService.deviceCreate(executor, path);
          return { ok: result.ok, output: result };
        }),
    },
  ],
  suggestedPrompts: [
    "Lista mis proyectos Expo en este servidor y su estado de build",
    "Lanza un build de producción para Android de mi app",
    "Muéstrame la cuota de builds que me queda este mes",
  ],
};
