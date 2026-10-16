import { expect, it } from "vitest";
import { setVoiceInputLock, voiceInputLocked } from "./input-lock";
it("retains live voice lock when the note component unmounts and isolates panels", () => {
  setVoiceInputLock("panel-a", "realtime", true);
  setVoiceInputLock("panel-a", "note", true);
  setVoiceInputLock("panel-a", "note", false);
  expect(voiceInputLocked("panel-a")).toBe(true);
  expect(voiceInputLocked("panel-b")).toBe(false);
  setVoiceInputLock("panel-a", "realtime", false);
  expect(voiceInputLocked("panel-a")).toBe(false);
});
