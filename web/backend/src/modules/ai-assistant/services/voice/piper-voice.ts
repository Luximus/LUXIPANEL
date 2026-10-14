// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Piper voice engine — local, offline TTS that runs on the panel host (the
 * "CLI" audio provider). Independent of any cloud API key or quota: it spawns
 * the `piper` binary, feeds the reply text on stdin, and reads back a WAV clip.
 *
 * This mirrors the locality of the OpenAI voice engine (synthesis happens on
 * the panel host; the result is cached on the connected target by the caller).
 * Piper is TTS-only — there is no STT here. Paths come from env
 * (`PIPER_BIN`/`PIPER_DATA_DIR`/`PIPER_MODELS_DIR`).
 */

import { spawn } from "node:child_process";
import { readFile, unlink, access, readdir } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@config/env.js";
import type { AssistantConfig } from "../../models/assistant-config.types.js";
import type { VoiceProvider } from "./voice.types.js";
import { VoiceError } from "./voice.types.js";

const PIPER_BIN = env.PIPER_BIN;
const PIPER_DATA_DIR = env.PIPER_DATA_DIR;
const PIPER_MODELS_DIR = env.PIPER_MODELS_DIR;

/** List installed voice models (`*.onnx`) — empty array if the dir is missing. */
async function listModels(): Promise<string[]> {
  try {
    return (await readdir(PIPER_MODELS_DIR)).filter((f) => f.endsWith(".onnx")).sort();
  } catch {
    return [];
  }
}

/** Piper is usable when the binary is executable AND at least one model exists. */
export async function isPiperInstalled(): Promise<boolean> {
  try {
    await access(PIPER_BIN, FS.X_OK);
    return (await listModels()).length > 0;
  } catch {
    return false;
  }
}

const SPANISH_HINT =
  /[áéíóúñ¿¡]|\b(que|de|la|el|los|las|una|para|con|por|esto|esta|servidor|configuración|el panel)\b/i;

/**
 * Pick a model path for the given text. An explicit model name (from the voice
 * field) wins; otherwise choose by a cheap language heuristic (Spanish vs.
 * English), falling back to the first installed model.
 */
async function pickModel(text: string, preferred?: string): Promise<string> {
  const files = await listModels();
  if (files.length === 0) {
    throw new VoiceError("piper", `No hay modelos de voz Piper en ${PIPER_MODELS_DIR}.`);
  }
  if (preferred) {
    const hit = files.find((f) => f === preferred || f === `${preferred}.onnx` || f.startsWith(preferred));
    if (hit) return join(PIPER_MODELS_DIR, hit);
  }
  const want = SPANISH_HINT.test(text) ? /(^|[_-])es([_-]|$)/i : /(^|[_-])en([_-]|$)/i;
  const langHit = files.find((f) => want.test(f));
  return join(PIPER_MODELS_DIR, langHit ?? files[0]!);
}

/** Run piper: text in on stdin (never argv → stays out of `ps`), WAV out to a temp file. */
function runPiper(model: string, text: string, outFile: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      PIPER_BIN,
      ["--model", model, "--espeak_data", join(PIPER_DATA_DIR, "espeak-ng-data"), "--output_file", outFile],
      {
        // The runtime libs (libonnxruntime/libespeak-ng) sit next to the binary.
        env: { ...process.env, LD_LIBRARY_PATH: `${PIPER_DATA_DIR}:${process.env["LD_LIBRARY_PATH"] ?? ""}` },
        signal,
      },
    );
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += String(d);
      if (stderr.length > 4_000) stderr = stderr.slice(-4_000);
    });
    child.on("error", (err) => reject(new VoiceError("piper", `No se pudo ejecutar Piper: ${err.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new VoiceError("piper", `Piper terminó con código ${code}: ${stderr.slice(-200)}`));
    });
    child.stdin.on("error", () => undefined); // ignore EPIPE if piper exits early
    child.stdin.end(text);
  });
}

export function makePiperVoice(config: AssistantConfig): VoiceProvider {
  // The voice field doubles as an optional model name for the local engine;
  // ignore the OpenAI default ("alloy"), which is not a Piper model.
  const fromConfig = config.voice?.voice && config.voice.voice !== "alloy" ? config.voice.voice : undefined;
  return {
    id: "piper",
    async ping() {
      return (await isPiperInstalled())
        ? { ok: true, detail: "piper · voz local" }
        : { ok: false, detail: `Piper no está instalado (${PIPER_BIN}).` };
    },
    async speak(text, voice, signal) {
      if (!(await isPiperInstalled())) {
        throw new VoiceError("piper", "El motor de voz local (Piper) no está instalado en el host del panel.");
      }
      const preferred = voice && voice !== "alloy" ? voice : fromConfig;
      const model = await pickModel(text, preferred);
      const out = join(tmpdir(), `lxp-piper-${randomUUID()}.wav`);
      try {
        await runPiper(model, text, out, signal);
        const buf = await readFile(out);
        if (!buf.length) throw new VoiceError("piper", "Piper no generó audio.");
        return { audioBase64: buf.toString("base64"), mimeType: "audio/wav" };
      } finally {
        await unlink(out).catch(() => undefined);
      }
    },
  };
}
