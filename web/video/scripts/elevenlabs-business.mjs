import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";

// Read only the explicitly authorized Tolqia configuration. Secrets stay in
// memory; the script never writes the environment, headers or API key to disk.
const config = parseEnv(readFileSync(process.env.ELEVENLABS_ENV_FILE ?? "/var/www/tolqia/server/.env", "utf8"));
const apiKey = config.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error("ElevenLabs API key is not configured in Tolqia.");
const BASE = "https://api.elevenlabs.io";
const cache = resolve(".cache/elevenlabs-business");
mkdirSync(cache, { recursive: true });
async function api(path, body) {
  let response;
  try {
    response = await fetch(BASE + path, {
      method: body ? "POST" : "GET",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(90000),
    });
  } catch {
    throw new Error("ElevenLabs network request failed; no credentials were logged.");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const status = String(error.detail?.status ?? "upstream_error").replace(/[^a-zA-Z0-9_-]/g, "");
    throw new Error(`ElevenLabs HTTP ${response.status}: ${status}`);
  }
  return { data: await response.json(), requestId: response.headers.get("request-id"), characterCost: response.headers.get("character-cost") };
}

if (process.argv[2] === "inspect") {
  const voices = (await api("/v2/voices?voice_type=default&page_size=100&include_total_count=false")).data.voices ?? [];
  const safeVoices = voices.map(v => ({ id: v.voice_id, name: v.name, category: v.category, labels: v.labels, previewUrl: v.preview_url, languages: v.verified_languages?.map(x => x.language) }));
  writeFileSync(resolve(cache, "default-voices.json"), JSON.stringify(safeVoices, null, 2));
  const models = (await api("/v1/models")).data.filter(m => m.can_do_text_to_speech).map(m => ({ id: m.model_id, name: m.name }));
  let subscription;
  try {
    const s = (await api("/v1/user/subscription")).data;
    subscription = { tier: s.tier, remainingCharacters: s.character_limit - s.character_count };
  } catch { subscription = { readable: false }; }
  console.log(JSON.stringify({ configured: true, defaultVoiceAvailable: safeVoices.some(v => v.id === config.ELEVENLABS_DEFAULT_VOICE_ID), subscription, models, voices: safeVoices.map(({ previewUrl, ...v }) => v) }, null, 2));
} else if (process.argv[2] === "generate") {
  const manifest = JSON.parse(readFileSync("narration/business-voice.json", "utf8"));
  const language = process.argv[3];
  if (!["es", "en"].includes(language)) throw new Error("Choose es or en.");
  const voiceId = manifest.voices[language].id;
  const segments = manifest.segments;
  let previousIds = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const audioPath = resolve(cache, `${language}-${String(i + 1).padStart(2, "0")}.mp3`);
    const timingPath = audioPath.replace(/\.mp3$/, ".json");
    if (existsSync(audioPath) && existsSync(timingPath)) {
      const cached = JSON.parse(readFileSync(timingPath, "utf8"));
      if (cached.text === segment[language] && cached.voiceId === voiceId && cached.model === manifest.model) {
        if (cached.requestId) previousIds.push(cached.requestId);
        console.log(`${language} scene ${i + 1}: reused existing generation`);
        continue;
      }
      throw new Error(`Cached ${language} scene ${i + 1} differs from manifest; review before generating again.`);
    }
    const body = {
      text: segment[language], model_id: manifest.model, seed: 729600 + i,
      voice_settings: manifest.voiceSettings,
      ...(previousIds.length ? { previous_request_ids: previousIds.slice(-3) } : {}),
      ...(segments[i + 1] ? { next_text: segments[i + 1][language] } : {}),
    };
    const result = await api(`/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, body);
    if (!result.data.audio_base64 || !result.data.alignment) throw new Error(`Missing speech/timing for ${language} scene ${i + 1}`);
    writeFileSync(audioPath, Buffer.from(result.data.audio_base64, "base64"));
    const alignment = result.data.alignment;
    writeFileSync(timingPath, JSON.stringify({ text: segment[language], voiceId, model: manifest.model, requestId: result.requestId, characterCost: result.characterCost, alignment, normalizedAlignment: result.data.normalized_alignment }, null, 2));
    if (result.requestId) previousIds.push(result.requestId);
    const end = alignment.character_end_times_seconds.at(-1);
    console.log(`${language} scene ${i + 1}: ${segment[language].length} characters, speech ${end.toFixed(2)}s`);
  }
} else {
  throw new Error("Use inspect or generate <es|en>.");
}
