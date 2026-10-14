// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo store-credentials sub-service — surface the current store-account
 * credential state (cloud keys via GraphQL + file-based eas.json submit
 * credentials + locally staged files), stage Google/Apple credential files on
 * the connected server (0600, via SFTP), plus webhook + device registration.
 */

import { quoteArg } from "../../../../shared/executor/index.js";
import { errMessage } from "../../../../shared/utils/err-message.js";
import type { Executor } from "../../../../shared/executor/index.js";
import { assertPublicUrl } from "../../../../shared/net/ssrf-guard.js";
import type {
  AppleCredentialInput,
  CliResult,
  ExpoStoreCredentials,
  GoogleCredentialInput,
  StoreCredentialsInput,
  WebhookCreateInput,
} from "../../models/index.js";
import { expoConfigService } from "../expo-config.service.js";
import { expoApiService } from "../expo-api.service.js";
import { credentialsDir, EAS, log, runEas, sh } from "./expo-shell.js";
import { readEasSubmitCredentials, readProjectIdFromPath } from "./expo-config-parse.js";

export const expoCredentialsService = {
  /**
   * Current store-account credential state for the UI: the keys EAS has on the
   * owning account (cloud, via GraphQL — keyed on the projectId, passed or
   * derived from app.json) plus whether the panel has staged a local credential
   * file on the connected server. Never returns secret bodies.
   */
  async storeCredentials(
    executor: Executor,
    input: StoreCredentialsInput,
  ): Promise<ExpoStoreCredentials> {
    const projectId =
      input.projectId ?? (await readProjectIdFromPath(executor, input.path).catch(() => null));
    let cloud: { google: ExpoStoreCredentials["google"]["cloudKeys"]; apple: ExpoStoreCredentials["apple"]["cloudKeys"] } = {
      google: [],
      apple: [],
    };
    if (projectId) {
      try {
        const token = await expoConfigService.getToken();
        cloud = await expoApiService.storeCredentials(token, projectId);
      } catch (err) {
        log.warn(
          { err: errMessage(err) },
          "GraphQL store credentials lookup failed",
        );
      }
    }
    // File-based credentials referenced by the project's eas.json submit profile
    // (how many projects actually publish — the key lives in the repo).
    const projectFiles = await readEasSubmitCredentials(executor, input.path).catch(() => ({
      google: null,
      apple: null,
    }));

    // Local panel credential files staged under the panel config dir.
    const dir = credentialsDir();
    const ls = await sh(executor, `ls -1 ${quoteArg(dir)} 2>/dev/null || true`, 10_000).catch(() => null);
    const files = (ls?.stdout ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      google: {
        cloudKeys: cloud.google,
        projectFile: projectFiles.google,
        localFile: files.includes("google-service-account.json"),
      },
      apple: {
        cloudKeys: cloud.apple,
        projectFile: projectFiles.apple,
        localFile: files.some((f) => /^AuthKey_.*\.p8$/.test(f)),
      },
    };
  },

  /**
   * Write the Google Play service-account JSON to the connected server under
   * the config dir (0600, via SFTP — body never in argv) and return its path
   * for use in eas.json submit profiles.
   */
  async setGoogleCredential(executor: Executor, input: GoogleCredentialInput): Promise<{ path: string }> {
    const dir = credentialsDir();
    await sh(executor, `mkdir -p ${quoteArg(dir)} && chmod 700 ${quoteArg(dir)}`, 15_000);
    const target = `${dir}/google-service-account.json`;
    // Create AT 0600 (not umask 0644 then chmod): between the two round-trips
    // the service-account JSON would be world-readable on the server.
    await executor.writeFile(target, input.serviceAccountJson, { encoding: "utf8", mode: 0o600 });
    return { path: target };
  },

  /**
   * Write the Apple ASC API key (.p8) to the connected server under the config
   * dir (0600) and persist the issuer/key ids. Returns the .p8 path + ids for
   * the eas.json submit profile.
   */
  async setAppleCredential(
    executor: Executor,
    input: AppleCredentialInput,
  ): Promise<{ p8Path: string; issuerId: string; keyId: string }> {
    const dir = credentialsDir();
    await sh(executor, `mkdir -p ${quoteArg(dir)} && chmod 700 ${quoteArg(dir)}`, 15_000);
    const target = `${dir}/AuthKey_${input.keyId}.p8`;
    // Create AT 0600 (see setGoogleCredential): the ASC .p8 private key must
    // never be briefly world-readable via the umask window.
    await executor.writeFile(target, input.p8, { encoding: "utf8", mode: 0o600 });
    return { p8Path: target, issuerId: input.issuerId, keyId: input.keyId };
  },

  async webhookCreate(executor: Executor, input: WebhookCreateInput): Promise<CliResult> {
    // SSRF guard: https-only + public host. `eas` will POST build/submit events
    // (with our EAS session) to this URL, so reject loopback/RFC1918/link-local
    // — resolving the hostname — before persisting/forwarding it to the CLI.
    await assertPublicUrl(input.url, { httpsOnly: true });
    const cmd =
      `${EAS} webhook:create --event ${quoteArg(input.event)} ` +
      `--url ${quoteArg(input.url)} --non-interactive 2>&1`;
    return runEas(executor, input.path, cmd, 60_000);
  },

  async deviceCreate(executor: Executor, projectPath: string): Promise<CliResult> {
    return runEas(executor, projectPath, `${EAS} device:create --non-interactive 2>&1`, 120_000);
  },
};
