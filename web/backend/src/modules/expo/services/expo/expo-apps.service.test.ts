// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import type { ExpoProject } from "../../models/index.js";
import { deduplicateExpoProjects } from "./expo-apps.service.js";

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
