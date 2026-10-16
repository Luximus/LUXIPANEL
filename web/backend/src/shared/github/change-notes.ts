// SPDX-License-Identifier: AGPL-3.0-only
import { sanitizePublicText } from "../diagnostics/sanitize.js";
import { assertPublishableSource } from "../diagnostics/publication-check.js";

export interface PublicChangeNote { title: string; changes: string[] }
const START = "LUXIPANEL-NOTES-BEGIN";
const END = "LUXIPANEL-NOTES-END";
const INTERNAL = /\b[a-f0-9]{40}\b|\b[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b|LUXIPANEL-Task:|\/(?:var|etc|home)\//i;

function publicSentence(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\r\n]/.test(value) || INTERNAL.test(value))
    throw new Error("Las notas deben explicar el cambio sin códigos internos ni rutas privadas.");
  assertPublishableSource(value);
  return sanitizePublicText(value).trim();
}
export function validateChangeNotes(value: unknown): PublicChangeNote[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error("Formato de notas de actualización inválido.");
  return value.map(item => {
    if (!item || typeof item !== "object" || !Array.isArray(item.changes) || item.changes.length < 1 || item.changes.length > 8)
      throw new Error("Cada nota necesita un título y entre una y ocho mejoras.");
    return { title: publicSentence(item.title, 140), changes: item.changes.map((line: unknown) => publicSentence(line, 600)) };
  });
}
/** Read only note files changed by this turn, from its captured Git tree. */
export async function collectChangeNotes(files: string[], read: (file: string) => Promise<string>): Promise<PublicChangeNote[]> {
  const paths = files.filter(file => /^docs\/changes\/[a-z0-9][a-z0-9-]*\.json$/.test(file));
  if (paths.length > 12) throw new Error("El aporte contiene demasiadas notas de actualización.");
  const notes: PublicChangeNote[] = [];
  for (const file of paths) {
    const raw = await read(file);
    if (!raw) continue; // Deleted note.
    if (Buffer.byteLength(raw, "utf8") > 8192) throw new Error("Una nota de actualización supera el tamaño permitido.");
    notes.push(...validateChangeNotes([JSON.parse(raw)]));
  }
  return notes;
}
export function contributionMessage(id: string, notes: PublicChangeNote[] = []): string {
  const safe = validateChangeNotes(notes);
  return [safe[0]?.title || "Actualización de LUXIPANEL",
    ...(safe.length ? [START, JSON.stringify(safe), END] : []),
    "LUXIPANEL-Task: " + id].join("\n\n");
}
/** Public notes are explicit metadata, never a chat transcript or a raw commit subject. */
export function publishedChangeNotes(message: string): PublicChangeNote[] {
  const start = message.indexOf(START), end = message.indexOf(END, start + START.length);
  if (start < 0 || end < 0 || end - start > 65536) return [];
  try { return validateChangeNotes(JSON.parse(message.slice(start + START.length, end).trim())); }
  catch { return []; }
}
