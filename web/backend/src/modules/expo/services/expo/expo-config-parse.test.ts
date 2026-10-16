// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — expo config/build parsing (pure, no executor).
 *
 * Covers the app-config flattening (app.json wraps under `expo`; an evaluated
 * app.config.js may not), the ExpoProject projection from a raw config, and the
 * EAS build mapper (status/platform lowercasing + artifact-URL precedence).
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Executor } from "../../../../shared/executor/index.js";
import { flattenConfig, mergeAppConfig, projectFromConfig, readAppConfig, readProjectIdFromPath, detectExpoProject, mapBuild } from "./expo-config-parse.js";

describe("local Expo identity", () => {
  it("reads the same local identity for discovery, details and EAS without evaluating JS", async () => {
    const root = mkdtempSync(join(tmpdir(), "expo identity ' "));
    const executor = { exec: async (command: string) => ({ stdout: execFileSync("sh", ["-c", command], { encoding: "utf8" }), stderr: "", exitCode: 0, durationMs: 0 }) } as unknown as Executor;
    try {
      writeFileSync(join(root, "app.json"), JSON.stringify({ expo: { name: "Current app", slug: "public" } }));
      writeFileSync(join(root, "app.config.local.json"), JSON.stringify({ slug: "existing-app", extra: { eas: { projectId: "same-project" } } }));
      writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { expo: "*" } }));
      writeFileSync(join(root, "app.config.js"), "require('node:fs').writeFileSync(__dirname + '/EXECUTED', 'unsafe'); throw new Error('must not run');");
      expect((await detectExpoProject(executor, root))?.projectId).toBe("same-project");
      expect(projectFromConfig(root, await readAppConfig(executor, root)).slug).toBe("existing-app");
      expect(await readProjectIdFromPath(executor, root)).toBe("same-project");
      expect(existsSync(join(root, "EXECUTED"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reuses the private EAS identity without changing public defaults", () => {
    const base = { expo: { name: "LUXIPANEL", slug: "public", android: { package: "com.example.app" } } };
    const local = { slug: "existing-app", extra: { eas: { projectId: "existing-project" } }, android: { package: "com.owner.app" } };
    expect(projectFromConfig("/srv/mobile", mergeAppConfig(base, local))).toMatchObject({
      name: "LUXIPANEL", slug: "existing-app", projectId: "existing-project", androidPackage: "com.owner.app",
    });
    expect(base.expo.slug).toBe("public");
    expect(projectFromConfig("/srv/mobile", mergeAppConfig(base, null)).projectId).toBeNull();
    expect(mergeAppConfig(null, null)).toBeNull();
  });
});

describe("flattenConfig", () => {
  it("unwraps the app.json `expo` key", () => {
    expect(flattenConfig({ expo: { name: "App", slug: "app" } })).toEqual({ name: "App", slug: "app" });
  });
  it("returns the object unchanged when there is no `expo` wrapper", () => {
    expect(flattenConfig({ name: "App", slug: "app" })).toEqual({ name: "App", slug: "app" });
  });
});

describe("projectFromConfig", () => {
  it("derives name from the path and pulls slug/projectId/identifiers", () => {
    const raw = {
      expo: {
        slug: "my-app",
        android: { package: "com.acme.app" },
        ios: { bundleIdentifier: "com.acme.app" },
        extra: { eas: { projectId: "abc-123" } },
      },
    };
    expect(projectFromConfig("/home/dev/projects/my-app", raw)).toEqual({
      path: "/home/dev/projects/my-app",
      name: "my-app",
      slug: "my-app",
      projectId: "abc-123",
      androidPackage: "com.acme.app",
      iosBundleIdentifier: "com.acme.app",
    });
  });

  it("nulls every optional field when the config is missing", () => {
    expect(projectFromConfig("/srv/x", null)).toEqual({
      path: "/srv/x",
      name: "x",
      slug: null,
      projectId: null,
      androidPackage: null,
      iosBundleIdentifier: null,
    });
  });
});

describe("mapBuild", () => {
  it("lowercases platform/status and builds the dashboard URL", () => {
    const out = mapBuild({
      id: "b-1",
      platform: "ANDROID",
      status: "FINISHED",
      buildProfile: "production",
      createdAt: "2026-07-01T00:00:00Z",
      appVersion: "1.2.3",
      artifacts: { applicationArchiveUrl: "https://cdn/app.apk", buildUrl: "https://cdn/other" },
    });
    expect(out).toEqual({
      id: "b-1",
      platform: "android",
      status: "finished",
      profile: "production",
      createdAt: "2026-07-01T00:00:00Z",
      url: "https://expo.dev/builds/b-1",
      artifactUrl: "https://cdn/app.apk",
      appVersion: "1.2.3",
    });
  });

  it("falls back to buildUrl when the application archive is absent, and nulls the rest", () => {
    const out = mapBuild({ id: "b-2", artifacts: { buildUrl: "https://cdn/only" } });
    expect(out.artifactUrl).toBe("https://cdn/only");
    expect(out.platform).toBe("");
    expect(out.status).toBe("");
    expect(out.profile).toBeNull();
    expect(out.url).toBe("https://expo.dev/builds/b-2");
  });
});
