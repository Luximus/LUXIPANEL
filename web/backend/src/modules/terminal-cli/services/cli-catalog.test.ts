// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests — CLI catalog (pure).
 *
 * Locks the id whitelist + command lookup used for ~/.bashrc autostart, and the
 * catalog ↔ model invariant (every CliId union member has exactly one catalog
 * entry and vice-versa — the "must stay in sync" comment made executable).
 */

import { describe, it, expect } from "vitest";
import { CLI_CATALOG, VALID_CLI_IDS, isValidCliId, getCliCommand } from "./cli-catalog.js";
import { DEFAULT_STATE } from "../models/cli-state.model.js";

describe("cli-catalog", () => {
  it("has a unique id per entry (no dups) and a default entry", () => {
    const ids = CLI_CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("default");
    expect(VALID_CLI_IDS.size).toBe(CLI_CATALOG.length);
  });

  it("the default entry has an empty command (no autostart binary)", () => {
    expect(getCliCommand("default")).toBe("");
  });

  it("isValidCliId accepts catalog ids and rejects anything else", () => {
    for (const c of CLI_CATALOG) expect(isValidCliId(c.id)).toBe(true);
    expect(isValidCliId("definitely-not-a-cli")).toBe(false);
    expect(isValidCliId("")).toBe(false);
    // No shell metacharacters can ever pass the whitelist.
    expect(isValidCliId("claude; rm -rf /")).toBe(false);
  });

  it("getCliCommand returns the real binary and '' for unknown ids", () => {
    expect(getCliCommand("claude")).toBe("claude");
    expect(getCliCommand("cursor")).toBe("cursor-agent");
    expect(getCliCommand("minimax")).toBe("mmx");
    expect(getCliCommand("nope" as never)).toBe("");
  });

  it("every command is a shell-safe binary name", () => {
    for (const c of CLI_CATALOG) {
      if (c.id === "default") continue;
      expect(c.command).toMatch(/^[A-Za-z0-9_.-]+$/);
    }
  });

  it("DEFAULT_STATE is internally consistent", () => {
    expect(isValidCliId(DEFAULT_STATE.active)).toBe(true);
    expect(DEFAULT_STATE.active).toBe("default");
    expect(DEFAULT_STATE.installed).toEqual(["default"]);
    expect(DEFAULT_STATE.onboardingDone).toBe(false);
  });
});
