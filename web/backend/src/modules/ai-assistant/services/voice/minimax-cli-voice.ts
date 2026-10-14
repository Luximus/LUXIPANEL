// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MiniMax CLI voice engine — TTS via `mmx speech synthesize` on the CONNECTED
 * target server. This keeps the execution locality aligned with the assistant's
 * CLI providers and reuses the configured MiniMax provider slot for auth.
 *
 * The current mmx CLI (v1.0.16 checked on 2026-06-27) exposes speech synthesis
 * and voice listing, but not speech-to-text, so this engine is TTS-only.
 */

import { randomUUID } from "node:crypto";
import { quoteArg, type Executor } from "../../../../shared/executor/index.js";
// B-12: the bash env primer lives in ONE place (the CLI-bridge shell toolbox).
import { loginShell } from "../providers/cli/shell.js";
import type { AssistantConfig } from "../../models/assistant-config.types.js";
import type { VoiceProvider } from "./voice.types.js";
import { VoiceError } from "./voice.types.js";
import { MINIMAX_AUTH_TTL_MS } from "../providers/cli/cli-constants.js";

const minimaxAuthOk = new Map<string, number>();

async function ensureMinimaxAuth(executor: Executor, apiKey?: string): Promise<void> {
  const cacheKey = executor.target.id || executor.target.name || "default";
  const cached = minimaxAuthOk.get(cacheKey);
  if (cached && Date.now() - cached < MINIMAX_AUTH_TTL_MS) return;

  try {
    const st = await executor.exec(loginShell("mmx auth status --output json 2>/dev/null || true"), {
      timeoutMs: 10_000,
    });
    const parsed = JSON.parse(st.stdout.trim() || "{}") as { authenticated?: boolean };
    if (parsed.authenticated === true) {
      minimaxAuthOk.set(cacheKey, Date.now());
      return;
    }
  } catch {
    // Fall through to best-effort persisted login.
  }

  if (!apiKey) return;

  try {
    await executor.exec(
      loginShell(`mmx auth login --api-key ${quoteArg(apiKey)} --non-interactive >/dev/null 2>&1 || true`),
      { timeoutMs: 20_000 },
    );
    minimaxAuthOk.set(cacheKey, Date.now());
  } catch {
    // Let the real synth call surface the auth error verbatim.
  }
}

export function makeMiniMaxCliVoice(config: AssistantConfig, executor?: Executor | null): VoiceProvider {
  const cli = config.providers.minimax?.cli;
  const apiKey = config.providers.minimax?.api?.apiKey ?? "";
  return {
    id: "minimax",
    async ping() {
      if (!cli?.installed) return { ok: false, detail: "MiniMax CLI no instalado en el servidor target." };
      if (!cli.loggedIn && !apiKey) return { ok: false, detail: "MiniMax CLI sin login ni API key configurada." };
      return { ok: true, detail: "minimax cli · voz" };
    },
    async speak(text, voice) {
      if (!executor) {
        throw new VoiceError("minimax", "MiniMax CLI requiere un servidor target conectado.");
      }
      if (!cli?.installed) {
        throw new VoiceError("minimax", "MiniMax CLI no está instalado en el servidor target.");
      }

      await ensureMinimaxAuth(executor, apiKey || undefined);

      const jobId = randomUUID();
      const textFile = `/tmp/lxp-mmx-voice-${jobId}.txt`;
      const outFile = `/tmp/lxp-mmx-voice-${jobId}.mp3`;
      const pickedVoice = voice && voice !== "alloy" ? voice.trim() : "";
      try {
        await executor.writeFile(textFile, Buffer.from(text, "utf8"), { mode: 0o600 });
        const cmd = [
          "mmx speech synthesize",
          "--non-interactive",
          "--no-color",
          `--text-file ${quoteArg(textFile)}`,
          `--out ${quoteArg(outFile)}`,
          pickedVoice ? `--voice ${quoteArg(pickedVoice)}` : "",
        ]
          .filter(Boolean)
          .join(" ");
        const res = await executor.exec(loginShell(`${cmd} </dev/null`), { timeoutMs: 120_000 });
        if (res.exitCode !== 0) {
          throw new VoiceError("minimax", `MiniMax CLI TTS falló: ${(res.stderr || res.stdout).trim().slice(0, 300)}`);
        }
        const buf = await executor.readFile(outFile);
        const audio = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "binary");
        if (!audio.length) throw new VoiceError("minimax", "MiniMax CLI no generó audio.");
        return { audioBase64: audio.toString("base64"), mimeType: "audio/mpeg" };
      } finally {
        await executor
          .exec(`rm -f ${quoteArg(textFile)} ${quoteArg(outFile)}`, { timeoutMs: 10_000 })
          .catch(() => undefined);
      }
    },
  };
}
