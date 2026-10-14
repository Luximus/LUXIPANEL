// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_EVENT_ALLOWLIST,
  buildTargetUrl,
  isSafeNotificationTarget,
  linkToTarget,
  normalizePath,
} from "./search-target";

describe("isSafeNotificationTarget", () => {
  it("accepts a plain internal href", () => {
    expect(isSafeNotificationTarget({ href: "/panel/monitor" })).toBe(true);
    expect(isSafeNotificationTarget({ href: "/panel" })).toBe(true);
  });

  it("accepts href + query + hash + click", () => {
    expect(isSafeNotificationTarget({
      href: "/panel/nginx",
      query: { tab: "ssl" },
      hash: "#pref-audit",
      click: '[data-tab="ssl"]',
    })).toBe(true);
  });

  it("accepts a clickSeq with a conditional step", () => {
    expect(isSafeNotificationTarget({
      href: "/panel/chat",
      clickSeq: ["?#chat-list:open|#chat-toggle", "#chat-new"],
    })).toBe(true);
  });

  it("accepts an allowlisted event with scalar detail", () => {
    expect(isSafeNotificationTarget({
      href: "/panel",
      event: { name: "luxipanel:assistant-open-conversation", detail: { conversationId: "abc", n: 3, ok: true, x: null } },
    })).toBe(true);
  });

  it("rejects non-objects and empty targets", () => {
    for (const bad of [null, undefined, 1, "x", [], {}]) {
      expect(isSafeNotificationTarget(bad)).toBe(false);
    }
  });

  it("rejects external / traversal / non-panel hrefs", () => {
    for (const href of [
      "https://evil.example/panel",
      "//evil.example",
      "/panelx",
      "/etc/passwd",
      "/panel/../../etc",
      "javascript:alert(1)",
    ]) {
      expect(isSafeNotificationTarget({ href })).toBe(false);
    }
  });

  it("rejects unknown keys (fail-closed)", () => {
    expect(isSafeNotificationTarget({ href: "/panel", action: "logout" })).toBe(false);
    expect(isSafeNotificationTarget({ href: "/panel", onclick: "x" })).toBe(false);
  });

  it("rejects a bad hash", () => {
    expect(isSafeNotificationTarget({ href: "/panel", hash: "no-hash" })).toBe(false);
    expect(isSafeNotificationTarget({ href: "/panel", hash: `#${"a".repeat(65)}` })).toBe(false);
    expect(isSafeNotificationTarget({ href: "/panel", hash: "#a b" })).toBe(false);
  });

  it("rejects dangerous selectors and oversized click sequences", () => {
    expect(isSafeNotificationTarget({ href: "/panel", click: "<script>" })).toBe(false);
    expect(isSafeNotificationTarget({ href: "/panel", click: "" })).toBe(false);
    expect(isSafeNotificationTarget({ href: "/panel", click: "#a".padEnd(201, "b") })).toBe(false);
    expect(isSafeNotificationTarget({ href: "/panel", clickSeq: [] })).toBe(false);
    expect(isSafeNotificationTarget({ href: "/panel", clickSeq: ["#a", "#b", "#c", "#d", "#e", "#f", "#g"] })).toBe(false);
  });

  it("rejects events outside the allowlist", () => {
    expect(isSafeNotificationTarget({ event: { name: "luxipanel:whatever" } })).toBe(false);
    expect(isSafeNotificationTarget({ event: { name: "click" } })).toBe(false);
    for (const name of NOTIFICATION_EVENT_ALLOWLIST) {
      expect(isSafeNotificationTarget({ event: { name } })).toBe(true);
    }
  });

  it("rejects non-scalar event detail", () => {
    expect(isSafeNotificationTarget({
      event: { name: "luxipanel:assistant-open-conversation", detail: { nested: { a: 1 } } },
    })).toBe(false);
    expect(isSafeNotificationTarget({
      event: { name: "luxipanel:assistant-open-conversation", detail: { list: [1, 2] } },
    })).toBe(false);
    expect(isSafeNotificationTarget({
      event: { name: "luxipanel:assistant-open-conversation", detail: { nan: Number.NaN } },
    })).toBe(false);
  });

  it("rejects bad query values", () => {
    expect(isSafeNotificationTarget({ href: "/panel", query: { c: "" } })).toBe(false);
    expect(isSafeNotificationTarget({ href: "/panel", query: { "bad key": "x" } })).toBe(false);
    expect(isSafeNotificationTarget({ href: "/panel", query: { c: 1 as unknown as string } })).toBe(false);
    expect(isSafeNotificationTarget({ href: "/panel", query: { c: "a".repeat(201) } })).toBe(false);
  });
});

describe("linkToTarget", () => {
  it("splits path, query and hash", () => {
    expect(linkToTarget("/panel/preferences#pref-audit")).toEqual({ href: "/panel/preferences", hash: "#pref-audit" });
    expect(linkToTarget("/panel/nginx?tab=ssl")).toEqual({ href: "/panel/nginx", query: { tab: "ssl" } });
    expect(linkToTarget("/panel/chat?c=abc#x")).toEqual({ href: "/panel/chat", query: { c: "abc" }, hash: "#x" });
    expect(linkToTarget("/panel")).toEqual({ href: "/panel" });
  });

  it("returns null for anything not an internal panel link", () => {
    for (const bad of [null, undefined, 42, "", "https://evil.example/panel", "/other", "/paneling"]) {
      expect(linkToTarget(bad)).toBeNull();
    }
  });

  it("returns null when the hash is unsafe", () => {
    expect(linkToTarget("/panel/x#a b")).toBeNull();
  });
});

describe("buildTargetUrl", () => {
  it("rebuilds a relative URL", () => {
    expect(buildTargetUrl({ href: "/panel/preferences", hash: "#pref-audit" })).toBe("/panel/preferences#pref-audit");
    expect(buildTargetUrl({ href: "/panel/nginx", query: { tab: "ssl" } })).toBe("/panel/nginx?tab=ssl");
    expect(buildTargetUrl({})).toBe("/panel");
  });
});

describe("normalizePath", () => {
  it("strips the /panel prefix, query, hash and trailing slash", () => {
    expect(normalizePath("/panel")).toBe("/");
    expect(normalizePath("/panel/")).toBe("/");
    expect(normalizePath("/panel/monitor")).toBe("/monitor");
    expect(normalizePath("/panel/monitor/")).toBe("/monitor");
    expect(normalizePath("/monitor?a=1#b")).toBe("/monitor");
    expect(normalizePath("")).toBe("/");
  });
});
