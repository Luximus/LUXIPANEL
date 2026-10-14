// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests del grabador de voz (envoltura de `expo-audio`). Cubren los tres fallos
// que perdían audio o dejaban basura: el mime del contenedor, el borrado del
// temporal (≈1MB/min, tope 5 min) y el reset de la sesión de audio del sistema
// aunque la lectura del clip lance.
import { beforeEach, describe, expect, it, vi } from "vitest";

const readAsStringAsync = vi.fn();
const deleteAsync = vi.fn();
const setAudioModeAsync = vi.fn();
const requestRecordingPermissionsAsync = vi.fn();

// Instancia nativa simulada (una por `start`).
const recorders: Array<{ stop: ReturnType<typeof vi.fn>; record: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn>; prepareToRecordAsync: ReturnType<typeof vi.fn>; uri: string | null }> = [];

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64" },
  readAsStringAsync: (...a: unknown[]) => readAsStringAsync(...a),
  deleteAsync: (...a: unknown[]) => deleteAsync(...a),
}));
vi.mock("expo-audio", () => ({
  RecordingPresets: { HIGH_QUALITY: { extension: ".m4a" } },
  requestRecordingPermissionsAsync: (...a: unknown[]) => requestRecordingPermissionsAsync(...a),
  setAudioModeAsync: (...a: unknown[]) => setAudioModeAsync(...a),
  AudioModule: {
    AudioRecorder: class {
      uri: string | null = "file:///cache/clip.m4a";
      prepareToRecordAsync = vi.fn(async () => {});
      record = vi.fn();
      stop = vi.fn(async () => {});
      release = vi.fn();
      constructor() { recorders.push(this as never); }
    },
  },
}));

import { RECORDING_MIME, createVoiceRecorder, voiceCaptureSupported } from "./voice-recorder";

/** Vacía la cola de microtareas (el `cancel` es fire-and-forget). */
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  recorders.length = 0;
  requestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
  setAudioModeAsync.mockResolvedValue(undefined);
  readAsStringAsync.mockResolvedValue("QUJD");
  deleteAsync.mockResolvedValue(undefined);
});

describe("createVoiceRecorder — contrato del clip", () => {
  it("el mime es el tipo IANA real del contenedor (AAC en MPEG-4)", () => {
    // `audio/m4a` NO existe en el registro IANA: el motor STT Gemini del backend
    // reenvía el mime tal cual y lo rechazaba con 400.
    expect(RECORDING_MIME).toBe("audio/mp4");
    expect(voiceCaptureSupported).toBe(true);
  });

  it("stop() devuelve base64 + mime, borra el temporal y cierra la sesión de audio", async () => {
    const rec = createVoiceRecorder()!;
    await rec.start();
    expect(setAudioModeAsync).toHaveBeenCalledWith({ allowsRecording: true, playsInSilentMode: true });

    expect(await rec.stop()).toEqual({ base64: "QUJD", mime: "audio/mp4" });
    expect(deleteAsync).toHaveBeenCalledWith("file:///cache/clip.m4a", { idempotent: true });
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
    expect(recorders[0].release).toHaveBeenCalled();
  });

  it("si la lectura del clip lanza: borra igual el temporal y RESTAURA el modo de audio", async () => {
    readAsStringAsync.mockRejectedValue(new Error("EACCES"));
    const rec = createVoiceRecorder()!;
    await rec.start();

    await expect(rec.stop()).rejects.toThrow("EACCES");
    // Sin esto, iOS se quedaba con el indicador de micrófono activo y la
    // reproducción atenuada hasta matar la app.
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
    expect(deleteAsync).toHaveBeenCalledWith("file:///cache/clip.m4a", { idempotent: true });
    expect(recorders[0].release).toHaveBeenCalled();
  });

  it("stop() dos veces no re-lee ni re-borra (el grabador ya se soltó)", async () => {
    const rec = createVoiceRecorder()!;
    await rec.start();
    await rec.stop();
    expect(await rec.stop()).toBeNull();
    expect(deleteAsync).toHaveBeenCalledTimes(1);
  });

  it("cancel() para la grabación, borra el PARCIAL y cierra la sesión de audio", async () => {
    const rec = createVoiceRecorder()!;
    await rec.start();
    rec.cancel();
    await flush();
    expect(recorders[0].stop).toHaveBeenCalled();
    expect(deleteAsync).toHaveBeenCalledWith("file:///cache/clip.m4a", { idempotent: true });
    expect(readAsStringAsync).not.toHaveBeenCalled();
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
  });

  it("permiso denegado: propaga el error y no crea grabador", async () => {
    requestRecordingPermissionsAsync.mockResolvedValue({ granted: false });
    const rec = createVoiceRecorder()!;
    await expect(rec.start()).rejects.toThrow("microphone-permission-denied");
    expect(recorders).toHaveLength(0);
  });
});
