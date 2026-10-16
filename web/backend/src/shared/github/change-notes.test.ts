import { expect, it, vi } from "vitest";
import { collectChangeNotes, contributionMessage, publishedChangeNotes, validateChangeNotes } from "./change-notes.js";
const note = { title: "Elegir al agente desde el chat", changes: ["El menú lateral muestra las conversaciones del agente seleccionado."] };
it("round-trips explicit public notes without exposing the task identifier as content", () => {
  const message = contributionMessage("private-task-id", [note]);
  expect(message.split("\n")[0]).toBe(note.title);
  expect(publishedChangeNotes(message)).toEqual([note]);
  expect(JSON.stringify(publishedChangeNotes(message))).not.toContain("private-task-id");
});
it("collects only changed public note files from the supplied snapshot reader", async () => {
  const read = vi.fn(async () => JSON.stringify(note));
  const result = await collectChangeNotes(["web/frontend/src/view.tsx", "docs/changes/README.md", "docs/changes/2026-10-16-chat.json"], read);
  expect(result).toEqual([note]);
  expect(read).toHaveBeenCalledExactlyOnceWith("docs/changes/2026-10-16-chat.json");
});
it("ignores deleted notes but rejects malformed or excessive publication notes", async () => {
  expect(await collectChangeNotes(["docs/changes/deleted.json"], async () => "")).toEqual([]);
  await expect(collectChangeNotes(["docs/changes/invalid.json"], async () => "{")).rejects.toThrow();
  expect(() => validateChangeNotes([{ ...note, changes: [] }])).toThrow();
  expect(() => validateChangeNotes(Array(13).fill(note))).toThrow();
});
it.each(["a".repeat(40), "a".repeat(8) + "-aaaa-aaaa-aaaa-" + "a".repeat(12), "/var/www/private", "/etc/config", "line\nbreak"])("rejects internal identifiers, private paths and multiline fields: %s", value => {
  expect(() => validateChangeNotes([{ ...note, changes: [value] }])).toThrow();
});
it("does not turn internal Git messages or broken metadata into user-facing notes", () => {
  expect(publishedChangeNotes("chore: cambios del asistente internal-task")).toEqual([]);
  expect(publishedChangeNotes("LUXIPANEL-NOTES-BEGIN\ninvalid\nLUXIPANEL-NOTES-END")).toEqual([]);
});
