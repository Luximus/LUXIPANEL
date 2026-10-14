import { describe, expect, it } from "vitest";
import { historyRecord } from "./history-format.js";
describe("Historical LUXIPANEL log parsing", () => {
  it("preserves the original timestamp, correlation and stack of Pino errors", () => {
    const entry = historyRecord(JSON.stringify({ level: 50, time: 1234567890000, module: "mail", msg: "delivery failed", requestId: "req-1", err: { stack: "Error: failed\n at send (mail.ts:2)" } }));
    expect(entry).toMatchObject({ severity: "error", module: "mail", timestamp: "2009-02-13T23:31:30.000Z", requestId: "req-1", stack: "Error: failed\n at send (mail.ts:2)" });
  });
  it("keeps a multiline stack with its error rather than creating incidents for each frame", () => { const entry = historyRecord("Error: render failed\n    at render (view.ts:20)\n    at route (app.ts:10)", true); expect(entry?.message).toBe("Error: render failed"); expect(entry?.stack).toContain("at route"); });
  it("classifies warnings, ignores informational stdout and captures unlabelled stderr", () => { expect(historyRecord("build completed")).toBeUndefined(); expect(historyRecord("[WARN] deprecated")).toMatchObject({ severity: "warn" }); expect(historyRecord("connection refused", true)).toMatchObject({ severity: "error" }); expect(historyRecord('{"level":30,"msg":"ready"}')).toBeUndefined(); });
});
