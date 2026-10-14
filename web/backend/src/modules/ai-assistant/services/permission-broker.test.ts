// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests for the permission broker.
 *
 * Scope: the broker is a single-async-promise-per-request channel between the
 * CLI's `permissions.approve` MCP call and the panel's live SSE stream. This
 * file pins the four observable behaviors:
 *   1. request() injects a `permission_request` event AND blocks until resolve.
 *   2. request() with no live run buffer → fail-safe DENY (no injection, no block).
 *   3. request() with a `timeoutMs` that elapses → DENY + clear pending.
 *   4. resolve() and cancelConversation() settle every pending request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the registry so we can control `inject()`'s return value (false = no
// live run → fail-safe deny). The broker never inspects the event payload,
// only the boolean return.
vi.mock("./agent-run-registry.js", () => ({
  agentRunRegistry: {
    inject: vi.fn(),
    // El broker consulta el proveedor del run vivo para el `target` de la
    // notificación (deep-link `/panel?c=…&provider=…`).
    activeRuns: vi.fn(() => []),
  },
}));

// Mock the event bus so the broker's notification emit doesn't fan out to
// real listeners in the test process.
vi.mock("../../../shared/events/index.js", () => ({
  eventBus: { emit: vi.fn() },
  Events: { AI_PERMISSION_REQUESTED: "AI_PERMISSION_REQUESTED" },
}));

import { permissionBroker } from "./permission-broker.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { eventBus } from "../../../shared/events/index.js";

const registry = agentRunRegistry as unknown as { inject: ReturnType<typeof vi.fn> };
const bus = eventBus as unknown as { emit: ReturnType<typeof vi.fn> };

beforeEach(() => {
  registry.inject.mockReset();
  bus.emit.mockReset();
});

afterEach(async () => {
  // Drain anything left over so a stuck pending promise doesn't bleed into
  // the next test. cancelConversation denies every pending.
  // Walk the known conversations; in this test we only use "conv-A".
  permissionBroker.cancelConversation("conv-A");
});

describe("permissionBroker.request — fail-safe paths", () => {
  it("returns 'deny' when no live run buffer (inject returns false)", async () => {
    registry.inject.mockReturnValue(false);
    const decision = await permissionBroker.request({
      conversationId: "conv-A",
      tool: "Bash",
      title: "Run a command",
    });
    expect(decision).toBe("deny");
    expect(bus.emit).not.toHaveBeenCalled();
  });

  it("returns 'deny' on timeout (no resolve arrives in time)", async () => {
    registry.inject.mockReturnValue(true);
    const decision = await permissionBroker.request({
      conversationId: "conv-A",
      tool: "Bash",
      title: "Run a command",
      // 1 ms timeout — guaranteed to elapse before the test awaits resolution.
      timeoutMs: 1,
    });
    expect(decision).toBe("deny");
    // Two injections: the initial `permission_request`, plus the
    // `permission_resolved` notification emitted by `finalize` so the
    // SSE stream clears the prompt UI.
    expect(registry.inject).toHaveBeenCalledTimes(2);
    const firstEvt = registry.inject.mock.calls[0]![1] as { type: string };
    const secondEvt = registry.inject.mock.calls[1]![1] as { type: string; decision: string };
    expect(firstEvt.type).toBe("permission_request");
    expect(secondEvt.type).toBe("permission_resolved");
    expect(secondEvt.decision).toBe("deny");
  });
});

describe("permissionBroker.request — happy path", () => {
  it("injects permission_request + emits notification, blocks until resolve()", async () => {
    registry.inject.mockReturnValue(true);
    const requestPromise = permissionBroker.request({
      conversationId: "conv-A",
      tool: "Bash",
      title: "Run a command",
      detail: "rm -rf /",
    });
    // The injected event was emitted synchronously; emit follows the inject.
    await Promise.resolve(); // let the .then(eventBus.emit) microtask flush
    expect(registry.inject).toHaveBeenCalledOnce();
    const injected = registry.inject.mock.calls[0]![1] as {
      type: string;
      tool: string;
      title: string;
      detail?: string;
    };
    expect(injected.type).toBe("permission_request");
    expect(injected.tool).toBe("Bash");
    expect(injected.title).toBe("Run a command");
    expect(injected.detail).toBe("rm -rf /");

    expect(bus.emit).toHaveBeenCalledWith(
      "AI_PERMISSION_REQUESTED",
      expect.objectContaining({ tool: "Bash", title: "Run a command" }),
    );

    // pendingCount should reflect the open request.
    expect(permissionBroker.pendingCount("conv-A")).toBe(1);

    // Settle the request by calling resolve with the right requestId.
    const requestId = registry.inject.mock.calls[0]![1].id as string;
    const settled = permissionBroker.resolve("conv-A", requestId, "allow");
    expect(settled).toBe(true);

    const decision = await requestPromise;
    expect(decision).toBe("allow");
    expect(permissionBroker.pendingCount("conv-A")).toBe(0);
  });
});

describe("permissionBroker.resolve", () => {
  it("returns false for an unknown requestId", () => {
    expect(permissionBroker.resolve("conv-A", "nope", "deny")).toBe(false);
  });
});

describe("permissionBroker.cancelConversation", () => {
  it("denies every pending request and clears the bucket", async () => {
    registry.inject.mockReturnValue(true);
    const a = permissionBroker.request({ conversationId: "conv-A", tool: "A", title: "a" });
    const b = permissionBroker.request({ conversationId: "conv-A", tool: "B", title: "b" });
    await Promise.resolve();
    expect(permissionBroker.pendingCount("conv-A")).toBe(2);

    permissionBroker.cancelConversation("conv-A");
    expect(permissionBroker.pendingCount("conv-A")).toBe(0);
    expect(await a).toBe("deny");
    expect(await b).toBe("deny");
  });

  it("is a no-op when there are no pending requests", () => {
    expect(() => permissionBroker.cancelConversation("conv-A")).not.toThrow();
    expect(permissionBroker.pendingCount("conv-A")).toBe(0);
  });
});
