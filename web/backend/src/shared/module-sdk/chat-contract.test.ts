// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { chatContractErrors } from "./chat-contract.js";
import { buildCapability, defineModule, type ModuleManifest } from "./index.js";
const manifest: ModuleManifest = { id: "sample", name: "Sample", version: "1.0.0", capabilities: [], chat: { version: 1, operations: [{ id: "inspect", tool: "inspect", kind: "read", permission: "sample.read" }] } };
const factory = defineModule(module => module.tool("inspect", { title: "Inspect", description: "Inspect", kind: "read", permission: "sample.read", input: { type: "object" }, handler: async () => ({ ok: true, output: {} }) }));
describe("mandatory chat admission contract", () => {
  it("accepts complete matching runtime declarations", () => expect(buildCapability(manifest, factory).tools).toHaveLength(1));
  it("rejects modules without tools, missing bindings and permission mismatches", () => {
    expect(chatContractErrors({ id: "sample" }).length).toBeGreaterThan(0);
    expect(() => buildCapability(manifest, defineModule(() => {}))).toThrow("missing");
    expect(() => buildCapability({ ...manifest, chat: { version: 1, operations: [{ id: "inspect", tool: "inspect", kind: "action", permission: "sample.edit" }] } }, factory)).toThrow("mismatched");
  });
  it("rejects uncovered UI actions and undeclared extra runtime tools", () => {
    expect(chatContractErrors({ ...manifest, surface: { actions: ["sample.delete"] } })).toContain("chat: declared action sample.delete has no tool");
    expect(() => buildCapability(manifest, defineModule(module => { factory.setup(module); module.tool("hidden", { title: "hidden", description: "hidden", kind: "action", permission: "sample.execute", input: { type: "object" }, handler: async () => ({ ok: true, output: {} }) }); }))).toThrow("absent from the contract");
  });
});
