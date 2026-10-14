import { describe, expect, it, vi } from "vitest";
vi.mock("../assistant-api", () => ({ attachmentUrl: (id: string) => id, displayText: (m: any) => m.textTranslated ?? m.content }));
import { historyTurn } from "./history";

describe("persisted execution outcome", () => {
  it("does not promote CLI progress on a failed reload", () => {
    expect(historyTurn({ role: "assistant", content: "", cli: true, cliLog: "$ codex\nEstoy revisando", ts: "", error: "timeout" })).toMatchObject({ text: "", error: "timeout" });
  });
  it("retains manual interruption and confirmed clean answers", () => {
    expect(historyTurn({ role: "assistant", content: "", ts: "", interrupted: true })).toMatchObject({ stopped: true });
    expect(historyTurn({ role: "assistant", content: "Publicado", cli: true, cliLog: "$ codex\nEstoy revisando", ts: "" }).text).toBe("Publicado");
  });
});
