// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { isHiddenSettingKey } from "./settings.controller.js";
import { isPublicRepoBody, publicSearchBody, remoteFullName } from "./repository-store.controller.js";

describe("GitHub catalogue credential isolation", () => {
  it("hides the dedicated GitHub token from generic Settings reads", () => {
    expect(isHiddenSettingKey("repository_store.github_token")).toBe(true);
  });
  it("links only origin URLs for the requested GitHub repository", () => {
    expect(remoteFullName("https://github.com/Acme/App.git")).toBe("acme/app");
    expect(remoteFullName("git@github.com:Acme/App.git")).toBe("acme/app");
    expect(remoteFullName("https://github.com.evil.test/Acme/App.git")).toBeNull();
    expect(remoteFullName("https://gitlab.com/Acme/App.git")).toBeNull();
  });
  it("never returns private repository metadata in the public catalogue", () => {
    expect(isPublicRepoBody({ private: false })).toBe(true);
    expect(isPublicRepoBody({ private: true })).toBe(false);
    expect(isPublicRepoBody({ full_name: "secret/repo" })).toBe(false);
    expect(publicSearchBody({ total_count: 2, items: [{ full_name: "open/repo", private: false }, { full_name: "secret/repo", private: true }] }))
      .toMatchObject({ items: [{ full_name: "open/repo" }] });
  });
});
