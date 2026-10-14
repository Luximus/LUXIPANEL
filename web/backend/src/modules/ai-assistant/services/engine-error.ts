// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared base for the assistant's "engine" errors — a typed error carrying the
 * engine id that produced it plus an optional upstream HTTP status.
 *
 * `TranslationError` (translation engines) and `VoiceError` (voice engines)
 * were byte-identical three-liners; they now extend this base but keep their
 * own `name` so `instanceof`, `.engine`, `.status` and the wire-visible
 * `err.name`/`err.engine` all stay exactly as before.
 */
export class EngineError<E extends string = string> extends Error {
  constructor(
    public readonly engine: E,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "EngineError";
  }
}
