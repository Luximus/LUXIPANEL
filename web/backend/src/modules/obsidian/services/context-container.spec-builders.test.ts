// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — the pure spec builders that drive context-container creation.
 * These encode the module's idempotency key (`refKey`), the vault naming/slug
 * scheme, and the two "skip" rules: a project needs an id, and a chat attached
 * to a project never gets its own loose-chat container.
 *
 * Note: these are characterization tests over the pure helpers; the SSH-backed
 * `ensureOne`/`syncAll` orchestration is out of scope here.
 */

import { describe, it, expect } from "vitest";
import { slug, repoSpec, projectSpec, chatSpec } from "./context-container.service.js";

describe("slug", () => {
  it("normalizes accents, lowercases, and collapses to hyphens", () => {
    expect(slug("Mí Proyecto Ñandú")).toBe("mi-proyecto-nandu");
  });
  it("trims leading/trailing separators and caps length at 48", () => {
    expect(slug("--Hello World--")).toBe("hello-world");
    expect(slug("a".repeat(80)).length).toBe(48);
  });
  it("falls back to 'item' for empty/symbol-only input", () => {
    expect(slug("")).toBe("item");
    expect(slug("!!!")).toBe("item");
  });
});

describe("repoSpec", () => {
  it("keys idempotency on the absolute repo path and targets projects/", () => {
    const spec = repoSpec("/home/dev/apps/my-api");
    expect(spec.kind).toBe("repo");
    expect(spec.refKey).toBe("repo:/home/dev/apps/my-api");
    expect(spec.subdir).toBe("projects");
    expect(spec.slug).toBe("my-api");
    expect(spec.name).toBe("Repo: my-api");
    expect(spec.repoPath).toBe("/home/dev/apps/my-api");
  });
});

describe("projectSpec", () => {
  it("builds a spec keyed on the project id under assistant/", () => {
    const spec = projectSpec({ id: "p-123", title: "Panel" });
    expect(spec).not.toBeNull();
    expect(spec?.kind).toBe("project");
    expect(spec?.refKey).toBe("project:p-123");
    expect(spec?.subdir).toBe("assistant");
    // slug carries a short-id suffix for uniqueness across same-named projects.
    expect(spec?.slug.startsWith("panel-")).toBe(true);
  });

  it("returns null when the project has no id", () => {
    expect(projectSpec({ title: "no id" })).toBeNull();
  });

  it("defaults the title when blank", () => {
    expect(projectSpec({ id: "x", title: "   " })?.name).toBe("Proyecto: Proyecto");
  });
});

describe("chatSpec", () => {
  it("builds a loose-chat spec keyed on the conversation id under chats/", () => {
    const spec = chatSpec({ id: "c-9", title: "Dudas" });
    expect(spec?.kind).toBe("chat");
    expect(spec?.refKey).toBe("chat:c-9");
    expect(spec?.subdir).toBe("chats");
  });

  it("returns null for a chat attached to a project (lives under the project)", () => {
    expect(chatSpec({ id: "c-9", title: "Dudas", projectId: "p-1" })).toBeNull();
  });

  it("returns null when the chat has no id", () => {
    expect(chatSpec({ title: "orphan" })).toBeNull();
  });
});
