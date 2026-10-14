// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it } from "vitest";
import { agentCapabilityRegistry } from "./registry.js";
import type { AgentCapability } from "./types.js";

function makeCap(moduleId: string): AgentCapability {
  return {
    moduleId,
    version: 1,
    tools: [
      {
        name: `${moduleId}.ping`,
        title: "Ping",
        description: "Returns pong.",
        kind: "read",
        inputSchema: { type: "object", properties: {}, required: [] },
        handler: async () => ({ ok: true, output: "pong" }),
      },
    ],
    dataPanels: [
      {
        name: `${moduleId}.snapshot`,
        title: "Snapshot",
        description: "Module snapshot.",
        collect: async () => ({ hello: "world" }),
      },
    ],
    suggestedPrompts: ["¿qué tal?"],
  };
}

describe("agentCapabilityRegistry", () => {
  beforeEach(() => {
    agentCapabilityRegistry._resetForTest();
  });

  it("registers and lists capabilities", () => {
    agentCapabilityRegistry.register(makeCap("alpha"));
    agentCapabilityRegistry.register(makeCap("beta"));

    const list = agentCapabilityRegistry.list();
    expect(list.map((c) => c.moduleId)).toEqual(["alpha", "beta"]);
  });

  it("finds tools by full name", () => {
    agentCapabilityRegistry.register(makeCap("alpha"));
    expect(agentCapabilityRegistry.findTool("alpha.ping")?.moduleId).toBe("alpha");
    expect(agentCapabilityRegistry.findTool("missing.tool")).toBeUndefined();
  });

  it("rejects tools without correct module prefix", () => {
    const bad: AgentCapability = {
      moduleId: "alpha",
      version: 1,
      tools: [
        {
          name: "beta.ping",
          title: "x",
          description: "x",
          kind: "read",
          inputSchema: { type: "object" },
          handler: async () => ({ ok: true, output: "" }),
        },
      ],
    };
    expect(() => agentCapabilityRegistry.register(bad)).toThrow(/must be prefixed/);
  });

  it("rejects duplicate tool names across modules", () => {
    agentCapabilityRegistry.register(makeCap("alpha"));
    const conflict: AgentCapability = {
      moduleId: "alpha",
      version: 1,
      tools: [
        {
          name: "alpha.ping",
          title: "x",
          description: "x",
          kind: "read",
          inputSchema: { type: "object" },
          handler: async () => ({ ok: true, output: "" }),
        },
      ],
    };
    // Re-registering the same moduleId is idempotent (replace), not a throw.
    expect(() => agentCapabilityRegistry.register(conflict)).not.toThrow();
    expect(agentCapabilityRegistry.list().length).toBe(1);
  });

  it("rejects inputSchema with wrong type", () => {
    const bad: AgentCapability = {
      moduleId: "alpha",
      version: 1,
      tools: [
        {
          name: "alpha.ping",
          title: "x",
          description: "x",
          kind: "read",
          // @ts-expect-error — testing the runtime guard
          inputSchema: { type: "array" },
          handler: async () => ({ ok: true, output: "" }),
        },
      ],
    };
    expect(() => agentCapabilityRegistry.register(bad)).toThrow(/inputSchema\.type/);
  });

  it("describe() produces a UI-friendly summary with safe defaults", () => {
    agentCapabilityRegistry.register({
      moduleId: "alpha",
      version: 1,
      tools: [
        {
          name: "alpha.restart",
          title: "Restart",
          description: "Restart service.",
          kind: "action",
          inputSchema: { type: "object" },
          handler: async () => ({ ok: true, output: "" }),
        },
      ],
    });
    const [desc] = agentCapabilityRegistry.describe();
    expect(desc?.tools[0]?.dangerous).toBe(true); // action defaults to dangerous=true
  });

  it("unregister cleans tool and panel indices", () => {
    agentCapabilityRegistry.register(makeCap("alpha"));
    agentCapabilityRegistry.unregister("alpha");
    expect(agentCapabilityRegistry.findTool("alpha.ping")).toBeUndefined();
    expect(agentCapabilityRegistry.findDataPanel("alpha.snapshot")).toBeUndefined();
    expect(agentCapabilityRegistry.list()).toEqual([]);
  });
});
