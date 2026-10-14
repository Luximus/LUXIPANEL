// Grabador de voz nativo (envoltura imperativa de `expo-audio`) para el composer
// del asistente IA. El composer (VoiceComposerButton) permanece agnóstico de la
// librería: solo conoce la interfaz `VoiceRecorderHandle` (start/stop/cancel).
//
// El clip se devuelve como base64 + mime para que el panel lo mande por el túnel
// a `POST /api/ai/voice/transcribe` (STT del servidor).
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import type { VoiceRecorderHandle } from "../components/AssistantComposerExtras";

/** La captura de micrófono solo aplica en plataformas nativas (iOS/Android).
 *  En web/SSR el botón de voz debe permanecer oculto. */
export const voiceCaptureSupported = Platform.OS === "ios" || Platform.OS === "android";

// HIGH_QUALITY graba AAC en contenedor MPEG-4 (fichero `.m4a`) en iOS y Android.
// El mime DEBE ser el tipo IANA real del contenedor: `audio/mp4`. Con el antiguo
// `audio/m4a` (que no existe en el registro IANA) el motor STT Gemini del backend
// —que reenvía el mime tal cual— devolvía 400 y la voz nunca funcionaba con ese
// motor; con OpenAI sobrevivía solo por el fallback de extensión del fichero.
export const RECORDING_MIME = "audio/mp4";

/** Borra el fichero temporal del clip (best-effort). Cada minuto de grabación
 *  ocupa ≈1MB en la caché y NADIE lo borraba: cada nota de voz (hasta 5 min)
 *  dejaba basura permanente en el dispositivo. */
async function deleteClipFile(uri: string): Promise<void> {
  try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch { /* ya no existe */ }
}

/** Devuelve la sesión de audio del sistema al modo normal. En iOS, dejarla en
 *  modo grabación mantiene el indicador de micrófono activo y atenúa la
 *  reproducción hasta la siguiente grabación (o hasta matar la app). */
async function resetAudioMode(): Promise<void> {
  try { await setAudioModeAsync({ allowsRecording: false }); } catch { /* ignore */ }
}

/** Crea un grabador concreto respaldado por `expo-audio`. Devuelve `null` cuando
 *  la plataforma no soporta captura (web/SSR), de modo que el composer trate la
 *  voz como no disponible sin romperse. */
export function createVoiceRecorder(): VoiceRecorderHandle | null {
  if (!voiceCaptureSupported) return null;

  // Una instancia de grabador por sesión de captura (creada en `start`). Se
  // libera al detener/cancelar para no acumontar objetos nativos.
  let recorder: InstanceType<typeof AudioModule.AudioRecorder> | null = null;

  const release = (rec: InstanceType<typeof AudioModule.AudioRecorder> | null) => {
    try { rec?.release?.(); } catch { /* ignore */ }
  };

  return {
    async start() {
      // Permiso de micrófono: si el usuario lo deniega, propaga el error para
      // que el composer muestre su estado de error (string `voiceError`).
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) throw new Error("microphone-permission-denied");

      // Modo de audio que habilita grabación (y reproducción en silencioso iOS).
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await recorder.prepareToRecordAsync();
      recorder.record();
    },

    async stop() {
      const rec = recorder;
      if (!rec) return null;
      recorder = null;
      let uri: string | null = null;
      try {
        await rec.stop();
        uri = rec.uri ?? null;
        if (!uri) return null;
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!base64) return null;
        return { base64, mime: RECORDING_MIME };
      } finally {
        // Pase lo que pase (incluida una lectura que lanza): el clip ya está en
        // memoria como base64 → el temporal sobra; y la sesión de audio del
        // sistema DEBE volver a modo normal aquí, no después de la lectura.
        release(rec);
        if (uri) await deleteClipFile(uri);
        await resetAudioMode();
      }
    },

    cancel() {
      const rec = recorder;
      recorder = null;
      if (!rec) { void resetAudioMode(); return; }
      // Detener best-effort y descartar el clip PARCIAL sin leerlo: hay que
      // borrar su fichero igual (antes se quedaba en la caché para siempre).
      void (async () => {
        try { await rec.stop(); } catch { /* ignore */ }
        const uri = rec.uri;
        release(rec);
        if (uri) await deleteClipFile(uri);
        await resetAudioMode();
      })();
    },
  };
}
