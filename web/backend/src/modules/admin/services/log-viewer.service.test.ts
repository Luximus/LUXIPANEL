import { describe, it, expect } from "vitest";

import { logViewerService } from "./log-viewer.service";
import type { Executor } from "../../../shared/executor/index.js";

// These cases exercise the command-injection guards on the journalctl args.
// Validation runs BEFORE any command is dispatched to the executor, so invalid
// input rejects without touching the (never-called) executor stub.
const execNever: Executor = {
  exec: () => {
    throw new Error("executor should not be reached for invalid input");
  },
} as unknown as Executor;

describe("logViewerService.getServiceLogs — injection guards", () => {
  it("rejects an un-loggable service unit", async () => {
    await expect(
      logViewerService.getServiceLogs(execNever, "evil; rm -rf /"),
    ).rejects.toThrow(/not loggable/);
  });

  it("rejects 'since' with shell metacharacters", async () => {
    await expect(
      logViewerService.getServiceLogs(execNever, "nginx", { since: "$(reboot)" }),
    ).rejects.toThrow(/Invalid 'since'/);
    await expect(
      logViewerService.getServiceLogs(execNever, "nginx", { since: "1h;rm -rf /" }),
    ).rejects.toThrow(/Invalid 'since'/);
  });

  it("rejects 'until' with shell metacharacters", async () => {
    await expect(
      logViewerService.getServiceLogs(execNever, "nginx", { until: "`id`" }),
    ).rejects.toThrow(/Invalid 'until'/);
  });

  it("rejects 'grep' containing control characters", async () => {
    await expect(
      logViewerService.getServiceLogs(execNever, "nginx", { grep: "foo\nbar" }),
    ).rejects.toThrow(/Invalid 'grep'/);
    await expect(
      logViewerService.getServiceLogs(execNever, "nginx", { grep: "foo\x00bar" }),
    ).rejects.toThrow(/Invalid 'grep'/);
  });
});
