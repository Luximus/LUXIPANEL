// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExpoProject } from "../../models/index.js";
import { deduplicateExpoProjects, projectScanCommand } from "./expo-apps.service.js";

const project = (path: string, id: string | null, expoInstalled: boolean): ExpoProject => ({
  path,
  name: path.split("/").pop() ?? "app",
  slug: "app",
  projectId: id,
  androidPackage: null,
  iosBundleIdentifier: null,
  runtime: { expoInstalled, ngrokInstalled: expoInstalled },
});

describe("Expo project discovery", () => {
  it("prunes marked archives and dependencies while preserving independent apps", () => {
    const root = mkdtempSync(join(tmpdir(), "expo discovery ' [test] "));
    try {
      for (const folder of ["active", "independent", "archive/copy/mobile", "node_modules/dependency", "single-copy"]) {
        mkdirSync(join(root, folder), { recursive: true });
        writeFileSync(join(root, folder, "app.json"), "{}");
      }
      for (const folder of ["archive", "single-copy"]) writeFileSync(join(root, folder, ".luxipanel-expo-ignore"), "");
      const scan = (path: string) => {
        const markers = execFileSync("sh", ["-c", projectScanCommand([path], [], true)], { encoding: "utf8" });
        const ignored = markers.trim().split("\n").filter(Boolean).map(marker => marker.slice(0, -"/.luxipanel-expo-ignore".length));
        return execFileSync("sh", ["-c", projectScanCommand([path], ignored)], { encoding: "utf8" }).trim();
      };
      expect(scan(root).split("\n").sort()).toEqual([join(root, "active/app.json"), join(root, "independent/app.json")]);
      expect(scan(join(root, "archive"))).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps the usable checkout when two paths point to the same EAS app", () => {
    const id = "536727c1-3199-4c02-ae05-fd2422a4f262";
    const backup = project("/home/sample-user/lp-api-key-github-deploy/app", id.toUpperCase(), false);
    const active = project("/var/www/LP-LICENSE-SERVER/app", id, true);
    const independent = project("/var/www/luxisoft/mobile-projects/other", null, false);

    expect(deduplicateExpoProjects([backup, active, independent])).toEqual([active, independent]);
    expect(deduplicateExpoProjects([active, backup, independent])).toEqual([active, independent]);
  });

  it("keeps independent unlinked apps and resolves equally ready copies consistently", () => {
    const first = project("/var/www/app", "same-id", true);
    const copy = project("/home/user/very-long-audit-checkout/app", "same-id", true);
    const unlinked = project("/srv/other", null, false);

    expect(deduplicateExpoProjects([copy, first, unlinked])).toEqual([first, unlinked]);
  });
});
