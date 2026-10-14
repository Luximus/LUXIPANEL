// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo builds sub-service — cloud builds (detached launch + history/log/cancel
 * via the GraphQL API with an eas-cli fallback), store submissions, OTA update
 * publishing and build quota.
 */

import { quoteArg } from "../../../../shared/executor/index.js";
import { errMessage } from "../../../../shared/utils/err-message.js";
import type { Executor } from "../../../../shared/executor/index.js";
import type {
  BuildInput,
  BuildListInput,
  CliResult,
  ExpoBuild,
  ExpoBuildLogs,
  SubmitInput,
  UpdatePublishInput,
} from "../../models/index.js";
import { expoConfigService } from "../expo-config.service.js";
import { expoApiService } from "../expo-api.service.js";
import { EAS, log, runEas, safeJsonParse } from "./expo-shell.js";
import { mapBuild, type RawBuild, readProjectIdFromPath } from "./expo-config-parse.js";

export const expoBuildsService = {
  async build(executor: Executor, input: BuildInput): Promise<CliResult> {
    // `eas build` compresses + uploads the whole project to EAS before it
    // returns — even with `--no-wait` — which takes from tens of seconds to a
    // few minutes. Awaiting it synchronously tripped Cloudflare/nginx gateway
    // timeouts and left the panel's build modal hanging forever with no
    // feedback. So we launch it DETACHED on the connected server (nohup, output
    // to a log, all FDs off the SSH channel so closing the exec session can't
    // SIGHUP it) and return immediately. The queued build then surfaces in the
    // history (EAS GraphQL API) within seconds as EAS registers it.
    const token = await expoConfigService.getToken();
    const logFile = `/tmp/luxipanel-expo-build-${Date.now()}.log`;
    const easCmd =
      `${EAS} build --platform ${quoteArg(input.platform)} ` +
      `--profile ${quoteArg(input.profile)} --non-interactive --no-wait`;
    // Single line (the managed executor rejects control chars). `cd` runs
    // synchronously so a bad path fails fast (non-zero exit → surfaced to the
    // UI); only the eas invocation is backgrounded.
    const body =
      `export EXPO_TOKEN=${quoteArg(token)}; export CI=1; ` +
      `cd ${quoteArg(input.path)} || exit 1; ` +
      `nohup sh -lc ${quoteArg(easCmd)} < /dev/null > ${quoteArg(logFile)} 2>&1 & ` +
      `echo "Build lanzado en segundo plano"`;
    const result = await executor.exec(`sh -lc ${quoteArg(body)}`, { timeoutMs: 30_000 });
    return {
      ok: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      url: null,
    };
  },

  async buildList(executor: Executor, input: BuildListInput): Promise<ExpoBuild[]> {
    const limit = input.limit ?? 20;
    // Preferred path: the cloud GraphQL API keyed on the EAS projectId. It is
    // authoritative and needs neither `eas-cli` installed on the connected
    // server nor a successful `cd` into the project. The projectId may come from
    // the caller; if not, derive it from the project's app.json on the server so
    // this works regardless of what the client sends.
    const projectId = input.projectId ?? (await readProjectIdFromPath(executor, input.path).catch(() => null));
    if (projectId) {
      try {
        const token = await expoConfigService.getToken();
        return await expoApiService.builds(token, projectId, limit, input.offset ?? 0);
      } catch (err) {
        log.warn(
          { err: errMessage(err) },
          "GraphQL build list failed; falling back to eas-cli",
        );
      }
    }
    // Fallback: `eas build:list` in the project dir (legacy, needs eas-cli).
    const result = await runEas(
      executor,
      input.path,
      `${EAS} build:list --limit ${limit} --offset ${input.offset ?? 0} --json --non-interactive 2>/dev/null || true`,
      120_000,
    );
    const raw = safeJsonParse<RawBuild[]>(result.stdout.trim());
    if (!Array.isArray(raw)) return [];
    return raw.map(mapBuild);
  },

  async buildView(executor: Executor, projectPath: string, buildId: string): Promise<ExpoBuild | null> {
    const result = await runEas(
      executor,
      projectPath,
      `${EAS} build:view ${quoteArg(buildId)} --json --non-interactive 2>/dev/null || true`,
      60_000,
    );
    const raw = safeJsonParse<RawBuild>(result.stdout.trim());
    return raw ? mapBuild(raw) : null;
  },

  /**
   * Readable logs + structured failure for a build, via the cloud GraphQL API
   * (keyed on the global buildId, so no projectId / eas-cli needed). Powers the
   * history log viewer and the "analyze with AI" action.
   */
  async buildLogs(buildId: string): Promise<ExpoBuildLogs> {
    const token = await expoConfigService.getToken();
    return expoApiService.buildLogs(token, buildId);
  },

  async buildCancel(executor: Executor, projectPath: string, buildId: string): Promise<CliResult> {
    return runEas(
      executor,
      projectPath,
      `${EAS} build:cancel ${quoteArg(buildId)} --non-interactive 2>&1`,
      60_000,
    );
  },

  async submit(executor: Executor, input: SubmitInput): Promise<CliResult> {
    const cmd =
      `${EAS} submit --platform ${quoteArg(input.platform)} ` +
      `--profile ${quoteArg(input.profile)} --latest --non-interactive 2>&1`;
    return runEas(executor, input.path, cmd, 240_000);
  },

  /** Build quota / plan via GraphQL, with a CLI build-count fallback. */
  async getQuota(executor: Executor, projectPath?: string) {
    const token = await expoConfigService.getToken();
    const quota = await expoApiService.quota(token);
    if (projectPath && quota.remainingBuilds === null && quota.usedBuilds === null) {
      // Fallback: count builds created this month from the CLI list.
      try {
        const builds = await this.buildList(executor, { path: projectPath, limit: 50 });
        const now = new Date();
        const thisMonth = builds.filter((b) => {
          if (!b.createdAt) return false;
          const d = new Date(b.createdAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
        quota.buildsThisMonth = thisMonth;
      } catch {
        /* leave null */
      }
    }
    return quota;
  },

  async updatePublish(executor: Executor, input: UpdatePublishInput): Promise<CliResult> {
    const msg = input.message ? ` --message ${quoteArg(input.message)}` : ` --message ${quoteArg("Update")}`;
    return runEas(
      executor,
      input.path,
      `${EAS} update --branch ${quoteArg(input.branch)}${msg} --non-interactive 2>&1`,
      180_000,
    );
  },
};
