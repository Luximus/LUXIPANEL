// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo env-variables sub-service — list/create/update/delete EAS environment
 * variables. Preferred path is the cloud GraphQL API keyed on the projectId
 * (passed or derived from app.json); falls back to `eas env:*` when no
 * projectId is resolvable.
 */

import { quoteArg } from "../../../../shared/executor/index.js";
import { errMessage } from "../../../../shared/utils/err-message.js";
import type { Executor } from "../../../../shared/executor/index.js";
import type {
  EnvDeleteInput,
  EnvListInput,
  EnvSetInput,
  EnvUpdateInput,
  EnvVariable,
} from "../../models/index.js";
import { expoConfigService } from "../expo-config.service.js";
import { expoApiService } from "../expo-api.service.js";
import { EAS, log, runEas, safeJsonParse } from "./expo-shell.js";
import { readProjectIdFromPath } from "./expo-config-parse.js";

export const expoEnvService = {
  async envList(executor: Executor, input: EnvListInput): Promise<EnvVariable[]> {
    // Preferred path: the cloud GraphQL API keyed on the EAS projectId (no
    // eas-cli required). projectId comes from the caller or, failing that, is
    // derived from the project's app.json on the server.
    const projectId = input.projectId ?? (await readProjectIdFromPath(executor, input.path).catch(() => null));
    if (projectId) {
      try {
        const token = await expoConfigService.getToken();
        return await expoApiService.envVars(token, projectId);
      } catch (err) {
        log.warn(
          { err: errMessage(err) },
          "GraphQL env list failed; falling back to eas-cli",
        );
      }
    }
    // Fallback: `eas env:list` in the project dir (legacy, needs eas-cli).
    const scope = input.scope ? ` --scope ${quoteArg(input.scope)}` : "";
    const result = await runEas(
      executor,
      input.path,
      `${EAS} env:list${scope} --format json --non-interactive 2>/dev/null || true`,
      60_000,
    );
    const raw = safeJsonParse<
      Array<{ name?: string; scope?: string; visibility?: string; value?: string | null }>
    >(result.stdout.trim());
    if (!Array.isArray(raw)) return [];
    return raw.map((v) => ({
      id: null,
      name: v.name ?? "",
      scope: v.scope ?? input.scope ?? "project",
      visibility: v.visibility ?? "",
      value: v.value ?? null,
    }));
  },

  /**
   * Create an env variable. Preferred path is the GraphQL API (no eas-cli
   * needed) keyed on the projectId (passed or derived from app.json); falls back
   * to `eas env:create` only when no projectId is resolvable.
   */
  async envSet(executor: Executor, input: EnvSetInput): Promise<void> {
    const projectId =
      input.projectId ?? (await readProjectIdFromPath(executor, input.path).catch(() => null));
    if (projectId) {
      const token = await expoConfigService.getToken();
      await expoApiService.createEnvVar(token, projectId, {
        name: input.name,
        value: input.value,
        visibility: input.visibility,
        environments: input.environments ?? ["production"],
      });
      return;
    }
    // Fallback: `eas env:create` in the project dir (needs eas-cli).
    const cmd =
      `${EAS} env:create --name ${quoteArg(input.name)} --value ${quoteArg(input.value)} ` +
      `--scope ${quoteArg(input.scope)} --visibility ${quoteArg(input.visibility)} ` +
      `--non-interactive 2>&1`;
    await runEas(executor, input.path, cmd, 60_000);
  },

  /** Update an existing env variable by GraphQL id. */
  async envUpdate(input: EnvUpdateInput): Promise<void> {
    const token = await expoConfigService.getToken();
    await expoApiService.updateEnvVar(token, {
      id: input.id,
      name: input.name,
      value: input.value,
      visibility: input.visibility,
      environments: input.environments,
    });
  },

  /** Delete an env variable by GraphQL id. */
  async envDelete(input: EnvDeleteInput): Promise<void> {
    const token = await expoConfigService.getToken();
    await expoApiService.deleteEnvVar(token, input.id);
  },
};
